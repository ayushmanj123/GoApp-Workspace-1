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

func (c *MetadataClient) Publish(applicationID, tenantID, requestID string, rawBody []byte) (*APIResponse, int, error) {
	var reader io.Reader
	if len(rawBody) > 0 {
		reader = bytes.NewReader(rawBody)
	}
	return c.do(http.MethodPost, fmt.Sprintf("/api/v1/applications/%s/publish", applicationID), tenantID, requestID, reader)
}

func (c *MetadataClient) ListVersions(applicationID, tenantID, requestID, query string) (*APIResponse, int, error) {
	path := fmt.Sprintf("/api/v1/applications/%s/versions", applicationID)
	if query != "" {
		path += "?" + query
	}
	return c.do(http.MethodGet, path, tenantID, requestID, nil)
}

func (c *MetadataClient) GetVersion(applicationID, versionID, tenantID, requestID string) (*APIResponse, int, error) {
	return c.do(http.MethodGet, fmt.Sprintf("/api/v1/applications/%s/versions/%s", applicationID, versionID), tenantID, requestID, nil)
}

func (c *MetadataClient) do(method, path, tenantID, requestID string, body io.Reader) (*APIResponse, int, error) {
	req, err := http.NewRequest(method, c.baseURL+path, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-Id", tenantID)
	if requestID != "" {
		req.Header.Set("X-Request-ID", requestID)
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
