// Package mail sends transactional email over SMTP, or nothing when unconfigured.
package mail

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

// Mailer delivers a plain-text message.
type Mailer interface {
	Send(ctx context.Context, to, subject, body string) error
	Enabled() bool
}

// ErrDisabled is returned by the no-op mailer.
var ErrDisabled = errors.New("email is not configured")

// Nop is used when no SMTP settings exist.
type Nop struct{}

func (Nop) Send(context.Context, string, string, string) error { return ErrDisabled }
func (Nop) Enabled() bool                                      { return false }

// SMTP sends through an authenticated STARTTLS relay (Brevo, Mailgun, ...).
type SMTP struct {
	Host, User, Pass, From string
	Port                   int
	Timeout                time.Duration
}

func (SMTP) Enabled() bool { return true }

// Send dials with a timeout, upgrades to TLS, authenticates and submits one message.
func (m SMTP) Send(ctx context.Context, to, subject, body string) error {
	timeout := m.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second
	}
	addr := fmt.Sprintf("%s:%d", m.Host, m.Port)
	d := net.Dialer{Timeout: timeout}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	_ = conn.SetDeadline(time.Now().Add(timeout))
	c, err := smtp.NewClient(conn, m.Host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer c.Close()
	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(&tls.Config{ServerName: m.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("smtp starttls: %w", err)
		}
	}
	if m.User != "" {
		if err := c.Auth(smtp.PlainAuth("", m.User, m.Pass, m.Host)); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := c.Mail(m.From); err != nil {
		return fmt.Errorf("smtp from: %w", err)
	}
	if err := c.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write([]byte(Build(m.From, to, subject, body))); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close: %w", err)
	}
	return c.Quit()
}

// Build renders a minimal RFC 5322 message.
func Build(from, to, subject, body string) string {
	var id [16]byte
	_, _ = rand.Read(id[:])
	domain := "study-tracker"
	if at := strings.LastIndex(from, "@"); at >= 0 {
		domain = from[at+1:]
	}
	headers := []string{
		"From: Study Tracker <" + from + ">",
		"To: " + to,
		"Subject: " + sanitize(subject),
		"Date: " + time.Now().UTC().Format(time.RFC1123Z),
		"Message-ID: <" + hex.EncodeToString(id[:]) + "@" + domain + ">",
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"Content-Transfer-Encoding: 8bit",
	}
	return strings.Join(headers, "\r\n") + "\r\n\r\n" + strings.ReplaceAll(body, "\n", "\r\n") + "\r\n"
}

func sanitize(s string) string {
	return strings.NewReplacer("\r", " ", "\n", " ").Replace(s)
}
