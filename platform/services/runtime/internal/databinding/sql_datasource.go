package databinding

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
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
	cfg, err := d.repo.GetConnectorConfig(ctx, input.TenantID, input.EntityID, coalesceEnvironmentID(input.EnvironmentID, ctx))
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

	query, args, err := d.resolveListQueryArgs(ctx, input.TenantID, cfg, input.FilterExpr, limit, offset)
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
	rows, err := db.QueryContext(qctx, query, args...)
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
	query, _, err := d.resolveListQueryArgs(ctx, tenantID, cfg, FilterExpr{}, 50, 0)
	return query, err
}

func (d *SqlDataSource) resolveListQueryArgs(
	ctx context.Context,
	tenantID uuid.UUID,
	cfg *SqlConnectorConfig,
	filterExpr FilterExpr,
	limit, offset int,
) (string, []interface{}, error) {
	action, err := d.repo.GetAction(ctx, tenantID, cfg.ConnectorID, "list")
	if err == nil && action != nil && strings.TrimSpace(action.Endpoint) != "" {
		// Named-query connectors do not push filters into free-form SELECT text.
		query, wrapErr := WrapNamedSQLWithPaging(action.Endpoint)
		if wrapErr != nil {
			return "", nil, wrapErr
		}
		return query, []interface{}{limit, offset}, nil
	}
	if err != nil && !errors.Is(err, ErrRestActionNotFound) {
		return "", nil, err
	}
	from, err := QuoteSQLTable(cfg.Table)
	if err != nil {
		return "", nil, fmt.Errorf("databinding: sql list requires a table or a named list action: %w", err)
	}

	args := make([]interface{}, 0, len(filterExpr.Leaves)+2)
	where, whereArgs, err := buildSQLWhere(filterExpr)
	if err != nil {
		return "", nil, err
	}
	args = append(args, whereArgs...)
	args = append(args, limit, offset)
	limitParam := len(args) - 1
	offsetParam := len(args)
	if where == "" {
		return fmt.Sprintf(`SELECT * FROM %s LIMIT $%d OFFSET $%d`, from, limitParam, offsetParam), args, nil
	}
	return fmt.Sprintf(`SELECT * FROM %s WHERE %s LIMIT $%d OFFSET $%d`, from, where, limitParam, offsetParam), args, nil
}

func buildSQLWhere(expr FilterExpr) (string, []interface{}, error) {
	if expr.Empty() {
		return "", nil, nil
	}
	args := make([]interface{}, 0, len(expr.Leaves))
	parts := make([]string, 0, len(expr.Leaves))
	for _, leaf := range expr.Leaves {
		col, quoteErr := QuoteSQLIdent(leaf.Field)
		if quoteErr != nil {
			return "", nil, fmt.Errorf("databinding: invalid filter column %q: %w", leaf.Field, quoteErr)
		}
		op, opErr := sqlOperator(leaf.Op)
		if opErr != nil {
			return "", nil, opErr
		}
		args = append(args, sqlFilterValue(leaf))
		parts = append(parts, fmt.Sprintf(`%s %s $%d`, col, op, len(args)))
	}
	joiner := " AND "
	if expr.Combinator == CombinatorOr {
		joiner = " OR "
	}
	return strings.Join(parts, joiner), args, nil
}

func (d *SqlDataSource) Get(ctx context.Context, tenantID, _ uuid.UUID, key DataSourceKey, recordID uuid.UUID) (*DataItem, error) {
	if d == nil || d.repo == nil {
		return nil, fmt.Errorf("databinding: sql datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID, EnvironmentIDFromContext(ctx))
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

func (d *SqlDataSource) Create(ctx context.Context, tenantID, _ uuid.UUID, key DataSourceKey, data map[string]interface{}) (*DataItem, error) {
	if d == nil || d.repo == nil {
		return nil, fmt.Errorf("databinding: sql datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	if err := requireWritableSQLConfig(cfg); err != nil {
		return nil, err
	}

	payload := cloneSQLPayload(data)
	pkName := strings.TrimSpace(cfg.PrimaryKey)
	if _, hasPK := payload[pkName]; !hasPK {
		payload[pkName] = uuid.New().String()
	}

	cols, vals, err := buildSQLWriteColumns(payload)
	if err != nil {
		return nil, err
	}
	if len(cols) == 0 {
		return nil, fmt.Errorf("databinding: sql create requires at least one column")
	}

	from, err := QuoteSQLTable(cfg.Table)
	if err != nil {
		return nil, err
	}
	placeholders := make([]string, len(cols))
	args := make([]interface{}, len(vals))
	for i := range cols {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = vals[i]
	}
	query := fmt.Sprintf(
		`INSERT INTO %s (%s) VALUES (%s) RETURNING *`,
		from,
		strings.Join(cols, ", "),
		strings.Join(placeholders, ", "),
	)

	return d.queryOne(ctx, cfg.ConnectionString, query, args...)
}

func (d *SqlDataSource) Update(ctx context.Context, tenantID, _ uuid.UUID, key DataSourceKey, recordID uuid.UUID, data map[string]interface{}, _ int) (*DataItem, error) {
	if d == nil || d.repo == nil {
		return nil, fmt.Errorf("databinding: sql datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	if err := requireWritableSQLConfig(cfg); err != nil {
		return nil, err
	}

	payload := cloneSQLPayload(data)
	delete(payload, strings.TrimSpace(cfg.PrimaryKey))
	cols, vals, err := buildSQLWriteColumns(payload)
	if err != nil {
		return nil, err
	}
	if len(cols) == 0 {
		return nil, fmt.Errorf("databinding: sql update requires at least one column")
	}

	from, err := QuoteSQLTable(cfg.Table)
	if err != nil {
		return nil, err
	}
	pk, err := QuoteSQLIdent(cfg.PrimaryKey)
	if err != nil {
		return nil, err
	}

	setParts := make([]string, len(cols))
	args := make([]interface{}, 0, len(vals)+1)
	args = append(args, recordID.String())
	for i := range cols {
		setParts[i] = fmt.Sprintf("%s = $%d", cols[i], i+2)
		args = append(args, vals[i])
	}
	query := fmt.Sprintf(
		`UPDATE %s SET %s WHERE %s = $1 RETURNING *`,
		from,
		strings.Join(setParts, ", "),
		pk,
	)

	item, err := d.queryOne(ctx, cfg.ConnectionString, query, args...)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, ErrDataSourceNotFound
	}
	return item, nil
}

func (d *SqlDataSource) Delete(ctx context.Context, tenantID, _ uuid.UUID, key DataSourceKey, recordID uuid.UUID) error {
	if d == nil || d.repo == nil {
		return fmt.Errorf("databinding: sql datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return err
	}
	if err := requireWritableSQLConfig(cfg); err != nil {
		return err
	}

	from, err := QuoteSQLTable(cfg.Table)
	if err != nil {
		return err
	}
	pk, err := QuoteSQLIdent(cfg.PrimaryKey)
	if err != nil {
		return err
	}
	query := fmt.Sprintf(`DELETE FROM %s WHERE %s = $1`, from, pk)

	db, err := d.openDB(cfg.ConnectionString)
	if err != nil {
		return fmt.Errorf("databinding: open sql connection: %w", err)
	}
	defer db.Close()

	qctx, cancel := context.WithTimeout(ctx, d.timeout)
	defer cancel()
	result, err := db.ExecContext(qctx, query, recordID.String())
	if err != nil {
		return fmt.Errorf("databinding: sql delete failed: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("databinding: sql delete rows affected: %w", err)
	}
	if affected == 0 {
		return ErrDataSourceNotFound
	}
	return nil
}

func (d *SqlDataSource) queryOne(ctx context.Context, dsn, query string, args ...interface{}) (*DataItem, error) {
	db, err := d.openDB(dsn)
	if err != nil {
		return nil, fmt.Errorf("databinding: open sql connection: %w", err)
	}
	defer db.Close()

	qctx, cancel := context.WithTimeout(ctx, d.timeout)
	defer cancel()
	rows, err := db.QueryContext(qctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("databinding: sql write failed: %w", err)
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

func requireWritableSQLConfig(cfg *SqlConnectorConfig) error {
	if cfg == nil {
		return fmt.Errorf("databinding: sql connector config is required")
	}
	if strings.TrimSpace(cfg.Table) == "" {
		return fmt.Errorf("databinding: sql writes require a table-bound connector (named-query connectors are read-only)")
	}
	if strings.TrimSpace(cfg.PrimaryKey) == "" {
		return fmt.Errorf("databinding: sql writes require primary_key on connector")
	}
	return nil
}

func cloneSQLPayload(data map[string]interface{}) map[string]interface{} {
	out := map[string]interface{}{}
	for key, value := range data {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		switch key {
		case "recordId", "entityId", "version":
			continue
		default:
			out[key] = value
		}
	}
	return out
}

// buildSQLWriteColumns returns quoted column names and values in stable key order.
func buildSQLWriteColumns(data map[string]interface{}) ([]string, []interface{}, error) {
	if len(data) == 0 {
		return nil, nil, nil
	}
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	cols := make([]string, 0, len(keys))
	vals := make([]interface{}, 0, len(keys))
	for _, key := range keys {
		quoted, err := QuoteSQLIdent(key)
		if err != nil {
			return nil, nil, fmt.Errorf("databinding: sql write column %q: %w", key, err)
		}
		cols = append(cols, quoted)
		vals = append(vals, data[key])
	}
	return cols, vals, nil
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
