package databinding

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"io"
	"testing"

	"github.com/google/uuid"
)

func TestQuoteSQLTable(t *testing.T) {
	got, err := QuoteSQLTable("public.orders")
	if err != nil {
		t.Fatal(err)
	}
	if got != `"public"."orders"` {
		t.Fatalf("got %s", got)
	}
	if _, err := QuoteSQLTable("orders;drop"); err == nil {
		t.Fatal("expected error")
	}
}

type fakeSqlRepo struct {
	cfg    *SqlConnectorConfig
	action *SqlConnectorAction
}

func (f *fakeSqlRepo) GetConnectorConfig(context.Context, uuid.UUID, uuid.UUID) (*SqlConnectorConfig, error) {
	return f.cfg, nil
}

func (f *fakeSqlRepo) GetAction(context.Context, uuid.UUID, uuid.UUID, string) (*SqlConnectorAction, error) {
	if f.action == nil {
		return nil, ErrRestActionNotFound
	}
	return f.action, nil
}

type fakeSQLDriver struct {
	lastQuery string
	lastArgs  []driver.NamedValue
}

func (d *fakeSQLDriver) Open(string) (driver.Conn, error) {
	return &fakeSQLConn{d: d}, nil
}

type fakeSQLConn struct {
	d *fakeSQLDriver
}

func (c *fakeSQLConn) Prepare(string) (driver.Stmt, error) { return nil, driver.ErrSkip }
func (c *fakeSQLConn) Close() error                        { return nil }
func (c *fakeSQLConn) Begin() (driver.Tx, error)           { return nil, driver.ErrSkip }
func (c *fakeSQLConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	c.d.lastQuery = query
	c.d.lastArgs = args
	return &fakeSQLRows{
		cols: []string{"id", "name"},
		rows: [][]driver.Value{{"1", "Alice"}},
	}, nil
}

type fakeSQLRows struct {
	cols []string
	rows [][]driver.Value
	i    int
}

func (r *fakeSQLRows) Columns() []string { return r.cols }
func (r *fakeSQLRows) Close() error      { return nil }
func (r *fakeSQLRows) Next(dest []driver.Value) error {
	if r.i >= len(r.rows) {
		return io.EOF
	}
	copy(dest, r.rows[r.i])
	r.i++
	return nil
}

func TestSqlDataSourceQueryBuildsSafeSQL(t *testing.T) {
	drv := &fakeSQLDriver{}
	sql.Register("goapps-fake-sql-"+t.Name(), drv)

	connectorID := uuid.New()
	ds := NewSqlDataSource(&fakeSqlRepo{cfg: &SqlConnectorConfig{
		ConnectorID:      connectorID,
		Table:            "public.orders",
		ConnectionString: "postgres://ignored",
	}})
	ds.openDB = func(string) (*sql.DB, error) {
		return sql.Open("goapps-fake-sql-"+t.Name(), "")
	}

	result, err := ds.Query(context.Background(), QueryInput{
		TenantID: uuid.New(),
		EntityID: connectorID,
		Limit:    10,
		Offset:   5,
	})
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if drv.lastQuery != `SELECT * FROM "public"."orders" LIMIT $1 OFFSET $2` {
		t.Fatalf("unexpected query: %s", drv.lastQuery)
	}
	if len(result.Items) != 1 || result.Items[0]["name"] != "Alice" {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestSqlDataSourceCreateUnsupported(t *testing.T) {
	ds := NewSqlDataSource(&fakeSqlRepo{cfg: &SqlConnectorConfig{Table: "orders", ConnectionString: "x"}})
	if _, err := ds.Create(context.Background(), uuid.New(), uuid.New(), DataSourceKey{}, nil); err == nil {
		t.Fatal("expected unsupported error")
	}
}

func TestSqlDataSourceNamedListAction(t *testing.T) {
	drv := &fakeSQLDriver{}
	sql.Register("goapps-fake-sql-"+t.Name(), drv)

	connectorID := uuid.New()
	ds := NewSqlDataSource(&fakeSqlRepo{
		cfg: &SqlConnectorConfig{
			ConnectorID:      connectorID,
			ConnectionString: "postgres://ignored",
		},
		action: &SqlConnectorAction{
			ActionName: "list",
			Endpoint:   "SELECT id, name FROM public.orders WHERE active = true",
		},
	})
	ds.openDB = func(string) (*sql.DB, error) {
		return sql.Open("goapps-fake-sql-"+t.Name(), "")
	}

	_, err := ds.Query(context.Background(), QueryInput{
		TenantID: uuid.New(),
		EntityID: connectorID,
		Limit:    10,
		Offset:   0,
	})
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	want := `SELECT * FROM (SELECT id, name FROM public.orders WHERE active = true) AS goapps_named_q LIMIT $1 OFFSET $2`
	if drv.lastQuery != want {
		t.Fatalf("unexpected query: %s", drv.lastQuery)
	}
}

func TestValidateNamedSQLQuery(t *testing.T) {
	if err := ValidateNamedSQLQuery("SELECT 1"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateNamedSQLQuery("DELETE FROM t"); err == nil {
		t.Fatal("expected error")
	}
	if err := ValidateNamedSQLQuery("SELECT 1; DROP TABLE t"); err == nil {
		t.Fatal("expected error")
	}
}
