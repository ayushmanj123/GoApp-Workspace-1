// Package ssrf guards outbound HTTP URLs used by connectors against private targets.
package ssrf

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"strings"
)

var (
	// ErrBlockedURL is returned when a URL targets a disallowed scheme or host.
	ErrBlockedURL = errors.New("ssrf: url blocked")
)

// ValidateHTTPURL rejects non-http(s) schemes and private/link-local/loopback hosts
// unless REST_SSRF_ALLOW_PRIVATE=true (local development escape hatch).
func ValidateHTTPURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fmt.Errorf("%w: empty url", ErrBlockedURL)
	}
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrBlockedURL, err)
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("%w: scheme %q not allowed", ErrBlockedURL, u.Scheme)
	}
	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("%w: missing host", ErrBlockedURL)
	}
	if allowPrivate() {
		return nil
	}
	if isBlockedHost(host) {
		return fmt.Errorf("%w: host %q is not allowed", ErrBlockedURL, host)
	}
	return nil
}

func allowPrivate() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("REST_SSRF_ALLOW_PRIVATE")), "true")
}

func isBlockedHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	if h == "localhost" || strings.HasSuffix(h, ".localhost") || h == "metadata.google.internal" {
		return true
	}
	ip := net.ParseIP(h)
	if ip == nil {
		// Hostname: resolve and check all addresses.
		addrs, err := net.LookupIP(h)
		if err != nil {
			// Unresolvable hosts are left to the HTTP client; we only block known-bad names and resolved private IPs.
			return false
		}
		for _, a := range addrs {
			if isPrivateIP(a) {
				return true
			}
		}
		return false
	}
	return isPrivateIP(ip)
}

func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return true
	}
	// Extra cloud metadata ranges commonly used in SSRF.
	if ip4 := ip.To4(); ip4 != nil {
		// 169.254.0.0/16 link-local already covered; 100.64.0.0/10 CGNAT
		if ip4[0] == 100 && ip4[1] >= 64 && ip4[1] <= 127 {
			return true
		}
	}
	return false
}
