// Package push delivers Web Push notifications using VAPID.
package push

import (
	"context"
	"errors"
	"net/http"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// ErrGone means the push service no longer knows the subscription; the
// caller should delete it.
var ErrGone = errors.New("push: subscription gone")

// Subscription is the browser-side endpoint and keys.
type Subscription struct {
	Endpoint string
	P256dh   string
	Auth     string
}

// Sender delivers one payload to one subscription.
type Sender interface {
	Send(ctx context.Context, sub Subscription, payload []byte) error
	Enabled() bool
}

// Nop is used when VAPID keys are not configured.
type Nop struct{}

func (Nop) Send(context.Context, Subscription, []byte) error { return errors.New("push disabled") }
func (Nop) Enabled() bool                                    { return false }

// VAPID sends through the browser vendors' push services.
type VAPID struct {
	PublicKey  string
	PrivateKey string
	Subject    string // mailto: or https: URL identifying the sender
	Client     *http.Client
}

func (v VAPID) Enabled() bool { return v.PublicKey != "" && v.PrivateKey != "" }

func (v VAPID) Send(ctx context.Context, sub Subscription, payload []byte) error {
	client := v.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	res, err := webpush.SendNotificationWithContext(ctx, payload, &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
	}, &webpush.Options{
		Subscriber:      v.Subject,
		VAPIDPublicKey:  v.PublicKey,
		VAPIDPrivateKey: v.PrivateKey,
		TTL:             6 * 3600,
		HTTPClient:      client,
	})
	if err != nil {
		return err
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusGone:
		return ErrGone
	case res.StatusCode >= 300:
		return errors.New("push: " + res.Status)
	}
	return nil
}

// GenerateKeys returns a fresh (private, public) VAPID key pair.
func GenerateKeys() (private, public string, err error) {
	return webpush.GenerateVAPIDKeys()
}
