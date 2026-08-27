# Unused migration tree

These `20260614_*.sql` scripts are **not** applied by the metadata service migrator.

The active migration path is embedded under:

`services/metadata/internal/database/migrations/`

Useful indexes/checks from this folder were folded into `000024_perf_indexes_checks` (Phase 9.1).
Do not run these files manually against production databases.
