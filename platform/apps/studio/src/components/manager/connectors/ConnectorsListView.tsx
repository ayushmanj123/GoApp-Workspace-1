import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applicationsApi, type Application } from "../../../api/applications-api";
import {
  connectorsApi,
  type ConnectorRecord,
} from "../../../api/connectors-api";
import { Button, SearchInput } from "../../ui";
import { CreateConnectorModal } from "./CreateConnectorModal";
import styles from "./connectors-manager.module.css";

const APP_STORAGE_KEY = "goapps.connectors.selectedAppId";

export function ConnectorsListView() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState(
    () => sessionStorage.getItem(APP_STORAGE_KEY) ?? "",
  );
  const [connectors, setConnectors] = useState<ConnectorRecord[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    setLoadingApps(true);
    void applicationsApi
      .list()
      .then((data) => {
        setApps(data.items);
        setSelectedAppId((prev) => {
          if (prev && data.items.some((a) => a.id === prev)) return prev;
          return data.items[0]?.id ?? "";
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load applications");
      })
      .finally(() => setLoadingApps(false));
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      sessionStorage.setItem(APP_STORAGE_KEY, selectedAppId);
    }
  }, [selectedAppId]);

  const loadConnectors = useCallback(async () => {
    if (!selectedAppId) {
      setConnectors([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await connectorsApi.list(selectedAppId);
      setConnectors(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connectors");
    } finally {
      setLoading(false);
    }
  }, [selectedAppId]);

  useEffect(() => {
    void loadConnectors();
  }, [loadConnectors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return connectors;
    return connectors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.base_url ?? "").toLowerCase().includes(q) ||
        c.connector_type.toLowerCase().includes(q),
    );
  }, [connectors, search]);

  const handleDelete = async (connector: ConnectorRecord) => {
    const confirmed = window.confirm(
      `Delete connector "${connector.name}"? Galleries bound to this name will stop loading data.`,
    );
    if (!confirmed) return;
    setRemoving(connector.id);
    try {
      await connectorsApi.remove(connector.id);
      await loadConnectors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete connector");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Connectors</h1>
          <p className={styles.subtitle}>
            Configure REST and SQL data sources for your apps. Bind a Gallery Items
            formula to a connector name to load external rows at runtime.
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => setCreateOpen(true)}
          disabled={!selectedAppId}
          data-testid="new-connector-btn"
        >
          + New Connector
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.appSelectWrap}>
          <select
            className={styles.appSelect}
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            disabled={loadingApps || apps.length === 0}
            data-testid="connectors-app-select"
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
            placeholder="Search connectors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {loading || loadingApps ? (
        <div className={styles.loading}>Loading connectors…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          No connectors yet. Create a REST or SQL connector to bind external data.
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((connector) => (
            <article key={connector.id} className={styles.card} data-testid={`connector-card-${connector.name}`}>
              <div className={styles.cardInfo}>
                <div className={styles.cardName}>
                  <span className={styles.badge}>{connector.connector_type}</span>
                  {connector.name}
                </div>
                <div className={styles.cardMeta}>
                  {connector.base_url || "(no base URL)"} · auth:{" "}
                  {connector.authentication_type}
                </div>
              </div>
              <div className={styles.cardActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/studio/connectors/${connector.id}`)}
                >
                  Open
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleDelete(connector)}
                  disabled={removing === connector.id}
                >
                  {removing === connector.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedAppId ? (
        <CreateConnectorModal
          open={createOpen}
          applicationId={selectedAppId}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            void loadConnectors();
            navigate(`/studio/connectors/${id}`);
          }}
        />
      ) : null}
    </>
  );
}
