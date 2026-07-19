package databinding

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
)

type fakeStorageRepo struct {
	cfg *StorageConnectorConfig
	err error
}

func (f *fakeStorageRepo) GetConnectorConfig(context.Context, uuid.UUID, uuid.UUID, *uuid.UUID) (*StorageConnectorConfig, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.cfg, nil
}

type fakeStorageClient struct {
	mu      sync.Mutex
	objects map[string][]byte
	meta    map[string]minio.ObjectInfo
}

func newFakeStorageClient() *fakeStorageClient {
	return &fakeStorageClient{
		objects: map[string][]byte{},
		meta:    map[string]minio.ObjectInfo{},
	}
}

func (f *fakeStorageClient) PutObject(_ context.Context, _, objectName string, reader io.Reader, objectSize int64, opts minio.PutObjectOptions) (minio.UploadInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	buf := &bytes.Buffer{}
	if _, err := io.Copy(buf, reader); err != nil {
		return minio.UploadInfo{}, err
	}
	body := buf.Bytes()
	f.objects[objectName] = body
	f.meta[objectName] = minio.ObjectInfo{
		Key:          objectName,
		Size:         int64(len(body)),
		ETag:         "etag-" + objectName,
		ContentType:  opts.ContentType,
		LastModified: time.Now().UTC(),
	}
	_ = objectSize
	return minio.UploadInfo{Key: objectName, Size: int64(len(body)), ETag: "etag-" + objectName}, nil
}

func (f *fakeStorageClient) RemoveObject(_ context.Context, _, objectName string, _ minio.RemoveObjectOptions) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.objects, objectName)
	delete(f.meta, objectName)
	return nil
}

func (f *fakeStorageClient) StatObject(_ context.Context, _, objectName string, _ minio.StatObjectOptions) (minio.ObjectInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	info, ok := f.meta[objectName]
	if !ok {
		return minio.ObjectInfo{}, minio.ErrorResponse{Code: "NoSuchKey", Message: "not found"}
	}
	return info, nil
}

func (f *fakeStorageClient) ListObjects(_ context.Context, _ string, opts minio.ListObjectsOptions) <-chan minio.ObjectInfo {
	ch := make(chan minio.ObjectInfo)
	go func() {
		defer close(ch)
		f.mu.Lock()
		defer f.mu.Unlock()
		for key, info := range f.meta {
			if opts.Prefix != "" && !strings.HasPrefix(key, opts.Prefix) {
				continue
			}
			ch <- info
		}
	}()
	return ch
}

func TestStorageDataSourceCreateUpdateDelete(t *testing.T) {
	connectorID := uuid.New()
	client := newFakeStorageClient()
	ds := NewStorageDataSource(&fakeStorageRepo{cfg: &StorageConnectorConfig{
		ConnectorID: connectorID,
		Bucket:      "docs",
		Prefix:      "invoices/",
	}})
	ds.newClient = func(*StorageConnectorConfig) (storageClient, error) {
		return client, nil
	}

	created, err := ds.Create(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, map[string]interface{}{
		"key":          "a.txt",
		"content":      "hello",
		"content_type": "text/plain",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if (*created)["key"] != "invoices/a.txt" {
		t.Fatalf("expected prefixed key, got %#v", created)
	}
	if string(client.objects["invoices/a.txt"]) != "hello" {
		t.Fatalf("unexpected object body: %q", client.objects["invoices/a.txt"])
	}

	_, err = ds.Update(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, uuid.New(), map[string]interface{}{}, 0)
	if err == nil || !strings.Contains(err.Error(), "update is not supported") {
		t.Fatalf("expected update unsupported, got %v", err)
	}

	if err := ds.DeleteByObjectKey(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, "a.txt"); err != nil {
		t.Fatalf("DeleteByObjectKey: %v", err)
	}
	if _, ok := client.objects["invoices/a.txt"]; ok {
		t.Fatal("expected object removed")
	}
}

func TestStorageDataSourceCreateBase64AndUUIDKey(t *testing.T) {
	connectorID := uuid.New()
	client := newFakeStorageClient()
	ds := NewStorageDataSource(&fakeStorageRepo{cfg: &StorageConnectorConfig{
		ConnectorID: connectorID,
		Bucket:      "docs",
	}})
	ds.newClient = func(*StorageConnectorConfig) (storageClient, error) {
		return client, nil
	}

	payload := base64.StdEncoding.EncodeToString([]byte{0x00, 0x01, 0xff})
	created, err := ds.Create(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, map[string]interface{}{
		"content":          payload,
		"content_encoding": "base64",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	key := (*created)["key"].(string)
	if _, err := uuid.Parse(key); err != nil {
		t.Fatalf("expected UUID key, got %q", key)
	}
	if !bytes.Equal(client.objects[key], []byte{0x00, 0x01, 0xff}) {
		t.Fatalf("unexpected decoded body: %v", client.objects[key])
	}

	recordID := uuid.MustParse(key)
	if err := ds.Delete(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, recordID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
}

func TestStorageDataSourceCreateRequiresContent(t *testing.T) {
	ds := NewStorageDataSource(&fakeStorageRepo{cfg: &StorageConnectorConfig{Bucket: "docs"}})
	ds.newClient = func(*StorageConnectorConfig) (storageClient, error) {
		return newFakeStorageClient(), nil
	}
	_, err := ds.Create(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: uuid.New()}, map[string]interface{}{
		"key": "x",
	})
	if err == nil || !strings.Contains(err.Error(), "requires content") {
		t.Fatalf("expected content error, got %v", err)
	}
}
