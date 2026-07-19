package databinding

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"io"
	"strings"
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

func (f *fakeSqlRepo) GetConnectorConfig(context.Context, uuid.UUID, uuid.UUID, *uuid.UUID) (*SqlConnectorConfig, error) {
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
	cols := []string{"id", "name"}
	row := []driver.Value{"1", "Alice"}
	if len(args) > 0 {
		// Prefer last string-like arg as name for write RETURNING shapes.
		for i := len(args) - 1; i >= 0; i-- {
			if s, ok := args[i].Value.(string); ok && s != "" {
				row[1] = s
				break
			}
		}
		if s, ok := args[0].Value.(string); ok && strings.Contains(query, "WHERE") {
			row[0] = s
		}
	}
	return &fakeSQLRows{
		cols: cols,
		rows: [][]driver.Value{row},
	}, nil
}

func (c *fakeSQLConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	c.d.lastQuery = query
	c.d.lastArgs = args
	return driver.RowsAffected(1), nil
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

func TestSqlDataSourceQueryPushesFilters(t *testing.T) {
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

	_, err := ds.Query(context.Background(), QueryInput{
		TenantID: uuid.New(),
		EntityID: connectorID,
		Limit:    10,
		Offset:   0,
		FilterExpr: FilterExpr{
			Combinator: CombinatorAnd,
			Leaves: []ComparisonFilter{
				{Field: "Status", Op: OpEQ, Value: "Active"},
				{Field: "Region", Op: OpEQ, Value: "West"},
			},
		},
	})
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	want := `SELECT * FROM "public"."orders" WHERE "Status" = $1 AND "Region" = $2 LIMIT $3 OFFSET $4`
	if drv.lastQuery != want {
		t.Fatalf("unexpected query: %s", drv.lastQuery)
	}
	if len(drv.lastArgs) != 4 {
		t.Fatalf("expected 4 args, got %#v", drv.lastArgs)
	}
}

func TestSqlDataSourceQueryPushesOrAndComparisons(t *testing.T) {
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

	expr, err := ParseFilterExpr(`Amount>10 Or Status='Open'`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	_, err = ds.Query(context.Background(), QueryInput{
		TenantID:   uuid.New(),
		EntityID:   connectorID,
		Limit:      10,
		FilterExpr: expr,
	})
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	want := `SELECT * FROM "public"."orders" WHERE "Amount" > $1 OR "Status" = $2 LIMIT $3 OFFSET $4`
	if drv.lastQuery != want {
		t.Fatalf("unexpected query: %s", drv.lastQuery)
	}
}

func TestSqlDataSourceCreateUpdateDelete(t *testing.T) {
	drv := &fakeSQLDriver{}
	sql.Register("goapps-fake-sql-"+t.Name(), drv)

	connectorID := uuid.New()
	recordID := uuid.MustParse("11111111-1111-4111-8111-111111111111")
	ds := NewSqlDataSource(&fakeSqlRepo{cfg: &SqlConnectorConfig{
		ConnectorID:      connectorID,
		Table:            "public.orders",
		PrimaryKey:       "id",
		ConnectionString: "postgres://ignored",
	}})
	ds.openDB = func(string) (*sql.DB, error) {
		return sql.Open("goapps-fake-sql-"+t.Name(), "")
	}

	created, err := ds.Create(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, map[string]interface{}{
		"id":   recordID.String(),
		"name": "Bob",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !strings.HasPrefix(drv.lastQuery, `INSERT INTO "public"."orders"`) || !strings.Contains(drv.lastQuery, "RETURNING *") {
		t.Fatalf("unexpected create query: %s", drv.lastQuery)
	}
	if created == nil || (*created)["name"] == nil {
		t.Fatalf("unexpected create result: %#v", created)
	}

	updated, err := ds.Update(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, recordID, map[string]interface{}{
		"name": "Carol",
	}, 0)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	wantUpdate := `UPDATE "public"."orders" SET "name" = $2 WHERE "id" = $1 RETURNING *`
	if drv.lastQuery != wantUpdate {
		t.Fatalf("unexpected update query: %s", drv.lastQuery)
	}
	if updated == nil {
		t.Fatal("expected update row")
	}

	if err := ds.Delete(context.Background(), uuid.New(), uuid.New(), DataSourceKey{EntityID: connectorID}, recordID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	wantDelete := `DELETE FROM "public"."orders" WHERE "id" = $1`
	if drv.lastQuery != wantDelete {
		t.Fatalf("unexpected delete query: %s", drv.lastQuery)
	}
}

func TestSqlDataSourceWritesRequireTableAndPrimaryKey(t *testing.T) {
	ds := NewSqlDataSource(&fakeSqlRepo{cfg: &SqlConnectorConfig{
		ConnectionString: "postgres://ignored",
	}})
	_, err := ds.Create(context.Background(), uuid.New(), uuid.New(), DataSourceKey{}, map[string]interface{}{"name": "x"})
	if err == nil || !strings.Contains(err.Error(), "table-bound") {
		t.Fatalf("expected table-bound error, got %v", err)
	}

	ds = NewSqlDataSource(&fakeSqlRepo{cfg: &SqlConnectorConfig{
		Table:            "orders",
		ConnectionString: "postgres://ignored",
	}})
	_, err = ds.Create(context.Background(), uuid.New(), uuid.New(), DataSourceKey{}, map[string]interface{}{"name": "x"})
	if err == nil || !strings.Contains(err.Error(), "primary_key") {
		t.Fatalf("expected primary_key error, got %v", err)
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
