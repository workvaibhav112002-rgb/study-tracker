// Command vapid prints a fresh VAPID key pair for Web Push reminders.
//
//	go run ./cmd/vapid
package main

import (
	"fmt"
	"os"

	"study-tracker-backend/internal/push"
)

func main() {
	priv, pub, err := push.GenerateKeys()
	if err != nil {
		fmt.Fprintln(os.Stderr, "generate keys:", err)
		os.Exit(1)
	}
	fmt.Printf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", pub, priv)
}
