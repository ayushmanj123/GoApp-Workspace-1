package services

import "strings"

func containsIgnoreCase(s, sub string) bool {
	if sub == "" {
		return true
	}
	return strings.Contains(strings.ToLower(s), strings.ToLower(sub))
}
