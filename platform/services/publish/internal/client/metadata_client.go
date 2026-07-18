package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type APIResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
}

type MetadataClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewMetadataClient(baseURL string) *MetadataClient {
	return &MetadataClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: http.DefaultClient,
	}
}

type ForwardHeaders struct {
	TenantID      string
	UserID        string
	Authorization string
	RequestID     string
}

func (c *MetadataClient) Publish(applicationID string, hdr ForwardHeaders, rawBody []byte) (*APIResponse, int, error) {
	var reader io.Reader
	if len(rawBody) > 0 {
		reader = bytes.NewReader(rawBody)
	}
	return c.do(http.MethodPost, fmt.Sprintf("/api/v1/applications/%s/publish", applicationID), hdr, reader)
}

func (c *MetadataClient) ListVersions(applicationID string, hdr ForwardHeaders, query string) (*APIResponse, int, error) {
	path := fmt.Sprintf("/api/v1/applications/%s/versions", applicationID)
	if query != "" {
		path += "?" + query
	}
	return c.do(http.MethodGet, path, hdr, nil)
}

func (c *MetadataClient) GetVersion(applicationID, versionID string, hdr ForwardHeaders) (*APIResponse, int, error) {
	return c.do(http.MethodGet, fmt.Sprintf("/api/v1/applications/%s/versions/%s", applicationID, versionID), hdr, nil)
}

func (c *MetadataClient) Unpublish(applicationID string, hdr ForwardHeaders, rawBody []byte) (*APIResponse, int, error) {
	var reader io.Reader
	if len(rawBody) > 0 {
		reader = bytes.NewReader(rawBody)
	}
	return c.do(http.MethodPost, fmt.Sprintf("/api/v1/applications/%s/unpublish", applicationID), hdr, reader)
}

func (c *MetadataClient) Rollback(applicationID, versionID string, hdr ForwardHeaders, rawBody []byte) (*APIResponse, int, error) {
	var reader io.Reader
	if len(rawBody) > 0 {
		reader = bytes.NewReader(rawBody)
	}
	return c.do(http.MethodPost, fmt.Sprintf("/api/v1/applications/%s/versions/%s/rollback", applicationID, versionID), hdr, reader)
}

func (c *MetadataClient) Deprecate(applicationID, versionID string, hdr ForwardHeaders, rawBody []byte) (*APIResponse, int, error) {
	var reader io.Reader
	if len(rawBody) > 0 {
		reader = bytes.NewReader(rawBody)
	}
	return c.do(http.MethodPost, fmt.Sprintf("/api/v1/applications/%s/versions/%s/deprecate", applicationID, versionID), hdr, reader)
}

func (c *MetadataClient) do(method, path string, hdr ForwardHeaders, body io.Reader) (*APIResponse, int, error) {
	req, err := http.NewRequest(method, c.baseURL+path, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if hdr.TenantID != "" {
		req.Header.Set("X-Tenant-Id", hdr.TenantID)
	}
	if hdr.UserID != "" {
		req.Header.Set("X-User-Id", hdr.UserID)
	}
	if hdr.Authorization != "" {
		req.Header.Set("Authorization", hdr.Authorization)
	}
	if hdr.RequestID != "" {
		req.Header.Set("X-Request-ID", hdr.RequestID)
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, res.StatusCode, err
	}
	var envelope APIResponse
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, res.StatusCode, fmt.Errorf("decode metadata response: %w", err)
	}
	return &envelope, res.StatusCode, nil
}
