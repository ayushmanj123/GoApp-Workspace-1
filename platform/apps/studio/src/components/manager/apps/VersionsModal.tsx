import { useCallback, useEffect, useState } from "react";
import {
  publishApi,
  type ApplicationVersionSummary,
} from "../../../api/publish-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";
import styles from "./VersionsModal.module.css";

interface VersionsModalProps {
  open: boolean;
  applicationId: string;
  applicationName: string;
  currentVersionId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function VersionsModal({
  open,
  applicationId,
  applicationName,
  currentVersionId,
  onClose,
  onChanged,
}: VersionsModalProps) {
  const [versions, setVersions] = useState<ApplicationVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(currentVersionId);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void publishApi
      .listVersions(applicationId)
      .then((data) => setVersions(data.items ?? []))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load versions");
        setVersions([]);
      })
      .finally(() => setLoading(false));
  }, [applicationId]);

  useEffect(() => {
    if (!open) return;
    setActiveVersionId(currentVersionId);
    load();
  }, [open, load, currentVersionId]);

  if (!open) return null;

  const handleRollback = async (version: ApplicationVersionSummary) => {
    const confirmed = window.confirm(
      `Roll back to version ${version.version}? The global published pointer will move to this release.`,
    );
    if (!confirmed) return;
    setBusyId(version.id);
    setError(null);
    try {
      const result = await publishApi.rollback(applicationId, version.id);
      setActiveVersionId(result.version_id);
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeprecate = async (version: ApplicationVersionSummary) => {
    const isCurrent = version.id === activeVersionId;
    const confirmed = window.confirm(
      isCurrent
        ? `Deprecate version ${version.version}? It is the current published version — the app will revert to draft.`
        : `Deprecate version ${version.version}? It will no longer be available for rollback or promote.`,
    );
    if (!confirmed) return;
    setBusyId(version.id);
    setError(null);
    try {
      const result = await publishApi.deprecate(applicationId, version.id);
      if (result.was_current) {
        setActiveVersionId(null);
      }
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deprecate failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${modalStyles.dialog} ${styles.dialog}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Application versions"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Versions — {applicationName}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={modalStyles.body}>
          {loading ? (
            <p className={modalStyles.empty}>Loading versions…</p>
          ) : versions.length === 0 ? (
            <p className={modalStyles.empty}>
              No versions yet. Publish this application to create the first release.
            </p>
          ) : (
            <ul className={styles.list}>
              {versions.map((v) => {
                const isCurrent = v.id === activeVersionId;
                const isReleased = v.status === "released";
                const isDeprecated = v.status === "deprecated";
                const busy = busyId === v.id;
                return (
                  <li key={v.id} className={styles.row}>
                    <div className={styles.meta}>
                      <span className={styles.version}>{v.version}</span>
                      <span
                        className={[
                          styles.badge,
                          isCurrent ? styles.badgeCurrent : "",
                          isDeprecated ? styles.badgeDeprecated : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {isCurrent ? "current" : v.status}
                      </span>
                      <span className={styles.date}>
                        {new Date(v.created_on).toLocaleString()}
                      </span>
                    </div>
                    <div className={styles.actions}>
                      {isReleased && !isCurrent ? (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          disabled={busy || busyId !== null}
                          onClick={() => void handleRollback(v)}
                        >
                          {busy ? "…" : "Rollback"}
                        </button>
                      ) : null}
                      {!isDeprecated ? (
                        <button
                          type="button"
                          className={styles.actionDanger}
                          disabled={busy || busyId !== null}
                          onClick={() => void handleDeprecate(v)}
                        >
                          {busy ? "…" : "Deprecate"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {error ? (
            <p className={modalStyles.empty} style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          ) : null}
          <div className={modalStyles.footer}>
            <button type="button" className={modalStyles.cancelBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
