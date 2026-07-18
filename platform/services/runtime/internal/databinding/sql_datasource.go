package databinding

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// SqlDataSource queries an external Postgres table configured on a SQL connector.
type SqlDataSource struct {
	repo    SqlConnectorRepository
	openDB  func(dsn string) (*sql.DB, error)
	timeout time.Duration
}

// NewSqlDataSource builds a SQL connector datasource.
func NewSqlDataSource(repo SqlConnectorRepository) *SqlDataSource {
	return &SqlDataSource{
		repo: repo,
		openDB: func(dsn string) (*sql.DB, error) {
			return sql.Open("pgx", dsn)
		},
		timeout: 15 * time.Second,
	}
}

func (d *SqlDataSource) Kind() DataSourceKind {
	return DataSourceKindSql
}

func (d *SqlDataSource) Query(ctx context.Context, input QueryInput) (*QueryResult, error) {
	if d == nil || d.repo == nil {
		return nil, fmt.Errorf("databinding: sql datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, input.TenantID, input.EntityID)
	if err != nil {
		return nil, err
	}
	limit := input.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	query, err := d.resolveListQuery(ctx, input.TenantID, cfg)
	if err != nil {
		return nil, err
	}

	db, err := d.openDB(cfg.ConnectionString)
	if err != nil {
		return nil, fmt.Errorf("databinding: open sql connection: %w", err)
	}
	defer db.Close()

	qctx, cancel := context.WithTimeout(ctx, d.timeout)
	defer cancel()
	rows, err := db.QueryContext(qctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("databinding: sql query failed: %w", err)
	}
	defer rows.Close()

	items, err := scanSQLRows(rows)
	if err != nil {
		return nil, err
	}
	return &QueryResult{Items: items, Count: int64(len(items))}, nil
}

func (d *SqlDataSource) resolveListQuery(ctx context.Context, tenantID uuid.UUID, cfg *SqlConnectorConfig) (string, error) {
	action, err := d.repo.GetAction(ctx, tenantID, cfg.ConnectorID, "list")
	if err == nil && action != nil && strings.TrimSpace(action.Endpoint) != "" {
		return WrapNamedSQLWithPaging(action.Endpoint)
	}
	if err != nil && !errors.Is(err, ErrRestActionNotFound) {
		return "", err
	}
	from, err := QuoteSQLTable(cfg.Table)
	if err != nil {
		return "", fmt.Errorf("databinding: sql list requires a table or a named list action: %w", err)
	}
	return fmt.Sprintf(`SELECT * FROM %s LIMIT $1 OFFSET $2`, from), nil
}

func (d *SqlDataSource) Get(ctx context.Context, tenantID, _ uuid.UUID, key DataSourceKey, recordID uuid.UUID) (*DataItem, error) {
	if d == nil || d.repo == nil {
		return nil, fmt.Errorf("databinding: sql datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID)
	if err != nil {
		return nil, err
	}
	if cfg.PrimaryKey == "" {
		return nil, fmt.Errorf("databinding: sql get requires primary_key on connector")
	}
	from, err := QuoteSQLTable(cfg.Table)
	if err != nil {
		return nil, err
	}
	pk, err := QuoteSQLIdent(cfg.PrimaryKey)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`SELECT * FROM %s WHERE %s = $1 LIMIT 1`, from, pk)
	db, err := d.openDB(cfg.ConnectionString)
	if err != nil {
		return nil, fmt.Errorf("databinding: open sql connection: %w", err)
	}
	defer db.Close()

	qctx, cancel := context.WithTimeout(ctx, d.timeout)
	defer cancel()
	rows, err := db.QueryContext(qctx, query, recordID.String())
	if err != nil {
		return nil, fmt.Errorf("databinding: sql get failed: %w", err)
	}
	defer rows.Close()

	items, err := scanSQLRows(rows)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrDataSourceNotFound
	}
	return &items[0], nil
}

func (d *SqlDataSource) Create(context.Context, uuid.UUID, uuid.UUID, DataSourceKey, map[string]interface{}) (*DataItem, error) {
	return nil, fmt.Errorf("databinding: sql connector create is not supported in phase 7.6")
}

func (d *SqlDataSource) Update(context.Context, uuid.UUID, uuid.UUID, DataSourceKey, uuid.UUID, map[string]interface{}, int) (*DataItem, error) {
	return nil, fmt.Errorf("databinding: sql connector update is not supported in phase 7.6")
}

func (d *SqlDataSource) Delete(context.Context, uuid.UUID, uuid.UUID, DataSourceKey, uuid.UUID) error {
	return fmt.Errorf("databinding: sql connector delete is not supported in phase 7.6")
}

func scanSQLRows(rows *sql.Rows) ([]DataItem, error) {
	cols, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("databinding: read sql columns: %w", err)
	}
	items := make([]DataItem, 0)
	for rows.Next() {
		raw := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range raw {
			ptrs[i] = &raw[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, fmt.Errorf("databinding: scan sql row: %w", err)
		}
		item := DataItem{}
		for i, col := range cols {
			item[col] = normalizeSQLValue(raw[i])
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("databinding: iterate sql rows: %w", err)
	}
	return items, nil
}

func normalizeSQLValue(v interface{}) interface{} {
	switch t := v.(type) {
	case nil:
		return nil
	case []byte:
		return string(t)
	case time.Time:
		return t.UTC().Format(time.RFC3339Nano)
	default:
		return t
	}
}
