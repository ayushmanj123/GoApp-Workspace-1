import { useCallback, useEffect, useMemo, useState } from "react";
import { applicationsApi, type Application } from "../../../api/applications-api";
import {
  environmentsApi,
  type EnvironmentRecord,
} from "../../../api/environments-api";
import { Badge, Button, SearchInput } from "../../ui";
import { CreateEnvironmentModal } from "./CreateEnvironmentModal";
import { PromoteEnvironmentModal } from "./PromoteEnvironmentModal";
import { EnvSecretsModal } from "./EnvSecretsModal";
import styles from "./environments-manager.module.css";

const TYPE_BADGE_CLASS: Record<string, string> = {
  development: styles.typeBadgeDevelopment,
  test: styles.typeBadgeTest,
  production: styles.typeBadgeProduction,
};

export function EnvironmentsManagerPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [environments, setEnvironments] = useState<EnvironmentRecord[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingEnvs, setLoadingEnvs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<EnvironmentRecord | null>(null);
  const [secretsTarget, setSecretsTarget] = useState<EnvironmentRecord | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    setLoadingApps(true);
    void applicationsApi
      .list()
      .then((data) => {
        setApps(data.items);
        setSelectedAppId((prev) => prev || data.items[0]?.id || "");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load applications");
      })
      .finally(() => setLoadingApps(false));
  }, []);

  const loadEnvironments = useCallback(async () => {
    if (!selectedAppId) {
      setEnvironments([]);
      return;
    }
    setLoadingEnvs(true);
    setError(null);
    try {
      const data = await environmentsApi.list(selectedAppId);
      setEnvironments(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environments");
    } finally {
      setLoadingEnvs(false);
    }
  }, [selectedAppId]);

  const openRuntime = (env: EnvironmentRecord) => {
    if (!selectedAppId) return;
    if (!env.current_version_id) {
      setError(
        `Environment "${env.name}" has no promoted version yet. Promote a release first.`,
      );
      return;
    }
    const configured = (
      import.meta.env.VITE_RUNTIME_APP_URL as string | undefined
    )?.replace(/\/$/, "");
    if (!configured && import.meta.env.PROD) {
      setError("VITE_RUNTIME_APP_URL is not configured");
      return;
    }
    const base = configured ?? "http://localhost:5174";
    window.open(
      `${base}/apps/${selectedAppId}?environmentId=${encodeURIComponent(env.id)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  useEffect(() => {
    void loadEnvironments();
  }, [loadEnvironments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return environments;
    return environments.filter(
      (env) =>
        env.name.toLowerCase().includes(q) ||
        env.environment_type.toLowerCase().includes(q),
    );
  }, [environments, search]);

  const handleDelete = async (env: EnvironmentRecord) => {
    if (!selectedAppId) return;
    const confirmed = window.confirm(`Delete environment "${env.name}"?`);
    if (!confirmed) return;
    setRemoving(env.id);
    try {
      await environmentsApi.remove(selectedAppId, env.id);
      await loadEnvironments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete environment");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Environments</h1>
          <p className={styles.subtitle}>
            Configure development, test, and production deployment targets for
            each application, and promote released versions between them.
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => setCreateOpen(true)}
          disabled={!selectedAppId}
        >
          + New Environment
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.appSelectWrap}>
          <select
            className={styles.appSelect}
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            disabled={loadingApps || apps.length === 0}
            aria-label="Application"
          >
            {apps.length === 0 ? (
              <option value="">No applications</option>
            ) : (
              apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className={styles.searchWrap}>
          <SearchInput
            fullWidth
            placeholder="Search environments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loadingApps || loadingEnvs ? (
        <div className={styles.loading}>Loading environments…</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : !selectedAppId ? (
        <div className={styles.empty}>Create an application first.</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          No environments yet. Create one to start deploying releases.
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((env) => (
            <div key={env.id} className={styles.card}>
              <div className={styles.cardInfo}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardName}>{env.name}</span>
                  <Badge variant="default">
                    <span className={TYPE_BADGE_CLASS[env.environment_type]}>
                      {env.environment_type}
                    </span>
                  </Badge>
                </div>
                <div className={styles.cardMeta}>
                  {env.current_version
                    ? `Running version ${env.current_version}`
                    : "No version deployed yet"}
                </div>
              </div>
              <div className={styles.cardActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openRuntime(env)}
                  disabled={!env.current_version_id}
                  data-testid={`open-runtime-env-${env.id}`}
                >
                  Open
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSecretsTarget(env)}
                  data-testid={`env-secrets-${env.id}`}
                >
                  Secrets
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPromoteTarget(env)}
                >
                  Promote
                </Button>
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={removing === env.id}
                  onClick={() => void handleDelete(env)}
                >
                  {removing === env.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateEnvironmentModal
        open={createOpen}
        applicationId={selectedAppId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void loadEnvironments()}
      />
      <PromoteEnvironmentModal
        open={promoteTarget !== null}
        applicationId={selectedAppId}
        environment={promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onPromoted={() => void loadEnvironments()}
      />
      <EnvSecretsModal
        open={secretsTarget !== null}
        applicationId={selectedAppId}
        environment={secretsTarget}
        onClose={() => setSecretsTarget(null)}
      />
    </div>
  );
}
