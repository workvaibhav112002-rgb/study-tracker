package httpapi_test

import (
	"net/http"
	"strconv"
)

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

func newRequest(method, url string) (*http.Request, error) { return http.NewRequest(method, url, nil) }
