package databinding

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/google/uuid"
)

// fakeRestConnectorRepository is an in-memory RestConnectorRepository for tests.
type fakeRestConnectorRepository struct {
	configs map[uuid.UUID]*RestConnectorConfig
	actions map[uuid.UUID]map[string]*RestConnectorAction
}

func newFakeRestConnectorRepository() *fakeRestConnectorRepository {
	return &fakeRestConnectorRepository{
		configs: map[uuid.UUID]*RestConnectorConfig{},
		actions: map[uuid.UUID]map[string]*RestConnectorAction{},
	}
}

func (f *fakeRestConnectorRepository) withConnector(cfg RestConnectorConfig) *fakeRestConnectorRepository {
	f.configs[cfg.ConnectorID] = &cfg
	return f
}

func (f *fakeRestConnectorRepository) withAction(connectorID uuid.UUID, action RestConnectorAction) *fakeRestConnectorRepository {
	if f.actions[connectorID] == nil {
		f.actions[connectorID] = map[string]*RestConnectorAction{}
	}
	f.actions[connectorID][action.ActionName] = &action
	return f
}

func (f *fakeRestConnectorRepository) GetConnectorConfig(_ context.Context, _, connectorID uuid.UUID) (*RestConnectorConfig, error) {
	cfg, ok := f.configs[connectorID]
	if !ok {
		return nil, ErrDataSourceNotFound
	}
	return cfg, nil
}

func (f *fakeRestConnectorRepository) GetAction(_ context.Context, _, connectorID uuid.UUID, actionName string) (*RestConnectorAction, error) {
	byName, ok := f.actions[connectorID]
	if !ok {
		return nil, ErrRestActionNotFound
	}
	action, ok := byName[actionName]
	if !ok {
		return nil, ErrRestActionNotFound
	}
	return action, nil
}

func TestRestDataSourceQueryReturnsItems(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/items" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodGet {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"id":"1","Name":"Alice"},{"id":"2","Name":"Bob"}]`))
	}))
	defer server.Close()

	connectorID := uuid.New()
	repo := newFakeRestConnectorRepository().
		withConnector(RestConnectorConfig{ConnectorID: connectorID, Name: "Widgets", BaseURL: server.URL, Auth: RestAuthConfig{Type: "none"}}).
		withAction(connectorID, RestConnectorAction{ActionName: "list", HTTPMethod: "GET", Endpoint: "/items"})

	ds := NewRestDataSource(repo, server.Client())
	if ds.Kind() != DataSourceKindRest {
		t.Fatalf("expected rest kind, got %s", ds.Kind())
	}

	result, err := ds.Query(context.Background(), QueryInput{TenantID: uuid.New(), EntityID: connectorID, Limit: 10})
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if result.Count != 2 || len(result.Items) != 2 {
		t.Fatalf("expected 2 items, got %#v", result)
	}
	if result.Items[0]["Name"] != "Alice" {
		t.Fatalf("unexpected first item: %#v", result.Items[0])
	}
}

func TestRestDataSourceQueryForwardsFiltersAndPaging(t *testing.T) {
	var gotQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	}))
	defer server.Close()

	connectorID := uuid.New()
	repo := newFakeRestConnectorRepository().
		withConnector(RestConnectorConfig{ConnectorID: connectorID, BaseURL: server.URL}).
		withAction(connectorID, RestConnectorAction{ActionName: "list", HTTPMethod: "GET", Endpoint: "/items"})

	ds := NewRestDataSource(repo, server.Client())
	_, err := ds.Query(context.Background(), QueryInput{
		EntityID: connectorID,
		Limit:    5,
		Offset:   10,
		Filters:  []EqualsFilter{{Field: "Status", Value: "Active"}},
	})
	if err != nil {
		t.Fatalf("Query: %v", err)
	}

	query, err := url.ParseQuery(gotQuery)
	if err != nil {
		t.Fatalf("parse query %q: %v", gotQuery, err)
	}
	if query.Get("Status") != "Active" {
		t.Fatalf("expected Status filter forwarded, got %q", gotQuery)
	}
	if query.Get("limit") != "5" || query.Get("offset") != "10" {
		t.Fatalf("expected paging forwarded, got %q", gotQuery)
	}
}

func TestRestDataSourceGetReturnsItem(t *testing.T) {
	recordID := uuid.New()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expected := fmt.Sprintf("/items/%s", recordID)
		if r.URL.Path != expected {
			t.Fatalf("expected path %s, got %s", expected, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"` + recordID.String() + `","Name":"Carol"}`))
	}))
	defer server.Close()

	connectorID := uuid.New()
	repo := newFakeRestConnectorRepository().
		withConnector(RestConnectorConfig{ConnectorID: connectorID, BaseURL: server.URL}).
		withAction(connectorID, RestConnectorAction{ActionName: "get", HTTPMethod: "GET", Endpoint: "/items/{id}"})

	ds := NewRestDataSource(repo, server.Client())
	item, err := ds.Get(context.Background(), uuid.New(), uuid.New(), DataSourceKey{Kind: DataSourceKindRest, EntityID: connectorID}, recordID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if (*item)["Name"] != "Carol" {
		t.Fatalf("unexpected item: %#v", item)
	}
}

func TestRestDataSourceAppliesStaticHeaderAuth(t *testing.T) {
	var gotHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	}))
	defer server.Close()

	connectorID := uuid.New()
	repo := newFakeRestConnectorRepository().
		withConnector(RestConnectorConfig{
			ConnectorID: connectorID,
			BaseURL:     server.URL,
			Auth:        RestAuthConfig{Type: "header", HeaderName: "Authorization", HeaderValue: "Bearer secret-token"},
		}).
		withAction(connectorID, RestConnectorAction{ActionName: "list", HTTPMethod: "GET", Endpoint: "/items"})

	ds := NewRestDataSource(repo, server.Client())
	if _, err := ds.Query(context.Background(), QueryInput{EntityID: connectorID}); err != nil {
		t.Fatalf("Query: %v", err)
	}
	if gotHeader != "Bearer secret-token" {
		t.Fatalf("expected auth header forwarded, got %q", gotHeader)
	}
}

func TestRestDataSourceCreateSendsJSONBody(t *testing.T) {
	var gotBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		w.WriteHeader(http.StatusCreated)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"new-1","Name":"Dana"}`))
	}))
	defer server.Close()

	connectorID := uuid.New()
	repo := newFakeRestConnectorRepository().
		withConnector(RestConnectorConfig{ConnectorID: connectorID, BaseURL: server.URL}).
		withAction(connectorID, RestConnectorAction{ActionName: "create", HTTPMethod: "POST", Endpoint: "/items"})

	ds := NewRestDataSource(repo, server.Client())
	item, err := ds.Create(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, map[string]interface{}{"Name": "Dana"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if gotBody["Name"] != "Dana" {
		t.Fatalf("expected request body forwarded, got %#v", gotBody)
	}
	if (*item)["Name"] != "Dana" {
		t.Fatalf("unexpected created item: %#v", item)
	}
}

func TestRestDataSourceDeleteCallsConfiguredEndpoint(t *testing.T) {
	recordID := uuid.New()
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		if r.Method != http.MethodDelete {
			t.Fatalf("expected DELETE, got %s", r.Method)
		}
		expected := fmt.Sprintf("/items/%s", recordID)
		if r.URL.Path != expected {
			t.Fatalf("expected path %s, got %s", expected, r.URL.Path)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	connectorID := uuid.New()
	repo := newFakeRestConnectorRepository().
		withConnector(RestConnectorConfig{ConnectorID: connectorID, BaseURL: server.URL}).
		withAction(connectorID, RestConnectorAction{ActionName: "delete", HTTPMethod: "DELETE", Endpoint: "/items/{id}"})

	ds := NewRestDataSource(repo, server.Client())
	if err := ds.Delete(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, recordID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !called {
		t.Fatal("expected delete endpoint to be called")
	}
}

func TestRestDataSourceReturnsErrorOnHTTPFailureStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"boom"}`))
	}))
	defer server.Close()

	connectorID := uuid.New()
	repo := newFakeRestConnectorRepository().
		withConnector(RestConnectorConfig{ConnectorID: connectorID, BaseURL: server.URL}).
		withAction(connectorID, RestConnectorAction{ActionName: "list", HTTPMethod: "GET", Endpoint: "/items"})

	ds := NewRestDataSource(repo, server.Client())
	if _, err := ds.Query(context.Background(), QueryInput{EntityID: connectorID}); err == nil {
		t.Fatal("expected error for 500 response")
	}
}

func TestRestDataSourceMissingActionReturnsError(t *testing.T) {
	connectorID := uuid.New()
	repo := newFakeRestConnectorRepository().
		withConnector(RestConnectorConfig{ConnectorID: connectorID, BaseURL: "http://example.invalid"})

	ds := NewRestDataSource(repo, http.DefaultClient)
	if _, err := ds.Query(context.Background(), QueryInput{EntityID: connectorID}); err != ErrRestActionNotFound {
		t.Fatalf("expected ErrRestActionNotFound, got %v", err)
	}
}

func TestRestDataSourceUnknownConnectorReturnsError(t *testing.T) {
	repo := newFakeRestConnectorRepository()
	ds := NewRestDataSource(repo, http.DefaultClient)
	if _, err := ds.Query(context.Background(), QueryInput{EntityID: uuid.New()}); err != ErrDataSourceNotFound {
		t.Fatalf("expected ErrDataSourceNotFound, got %v", err)
	}
}