import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Application } from "../../../api/applications-api";
import { environmentsApi, type EnvironmentRecord } from "../../../api/environments-api";
import { publishApi } from "../../../api/publish-api";
import { appIconEmoji, formatRelativeTime, slugifyPackageId } from "./app-utils";
import { VersionsModal } from "./VersionsModal";
import styles from "./AppCard.module.css";

interface AppCardProps {
  app: Application;
  onPublishComplete?: () => void;
}

type CardStatus = "published" | "draft" | "error";

function resolveStatus(app: Application, syncError: boolean): CardStatus {
  if (syncError) return "error";
  if (app.status === "published") return "published";
  return "draft";
}

const STATUS_LABELS: Record<CardStatus, string> = {
  published: "Published",
  draft: "Draft",
  error: "Sync Error",
};

function runtimeBaseUrl(): string {
  const configured = (import.meta.env.VITE_RUNTIME_APP_URL as string | undefined)?.replace(
    /\/$/,
    "",
  );
  if (configured) return configured;
  if (import.meta.env.PROD) {
    throw new Error("VITE_RUNTIME_APP_URL is required in production builds");
  }
  return "http://localhost:5174";
}

function openRuntime(appId: string, environmentId?: string) {
  const path = environmentId
    ? `${runtimeBaseUrl()}/apps/${appId}?environmentId=${encodeURIComponent(environmentId)}`
    : `${runtimeBaseUrl()}/apps/${appId}`;
  window.open(path, "_blank", "noopener,noreferrer");
}

export function AppCard({ app, onPublishComplete }: AppCardProps) {
  const navigate = useNavigate();
  const [version, setVersion] = useState<string>("—");
  const [syncError, setSyncError] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [environments, setEnvironments] = useState<EnvironmentRecord[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void publishApi
      .listVersions(app.id)
      .then((data) => {
        if (cancelled) return;
        const latest = data.items[0];
        setVersion(latest?.version ?? "—");
        setSyncError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSyncError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [app.id]);

  useEffect(() => {
    let cancelled = false;
    void environmentsApi
      .list(app.id)
      .then((data) => {
        if (!cancelled) setEnvironments(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setEnvironments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [app.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const status = resolveStatus(app, syncError);
  const statusClass =
    status === "published"
      ? styles.statusPublished
      : status === "error"
        ? styles.statusError
        : styles.statusDraft;

  const handleOpenStudio = () => {
    navigate(`/studio/apps/${app.id}`);
  };

  const handlePublish = async () => {
    const confirmed = window.confirm(
      "Publish this application? A new immutable runtime version will be created.",
    );
    if (!confirmed) return;
    setPublishing(true);
    try {
      const result = await publishApi.publish(app.id);
      setVersion(result.version);
      setSyncError(false);
      onPublishComplete?.();
    } catch {
      setSyncError(true);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    const confirmed = window.confirm(
      "Unpublish this application? Runtime users will lose access until you republish or roll back.",
    );
    if (!confirmed) return;
    setUnpublishing(true);
    try {
      await publishApi.unpublish(app.id);
      setSyncError(false);
      onPublishComplete?.();
    } catch {
      setSyncError(true);
    } finally {
      setUnpublishing(false);
    }
  };

  const promotedEnvs = environments.filter((e) => e.current_version_id);

  return (
    <article
      className={[styles.card, status === "error" ? styles.cardError : ""].filter(Boolean).join(" ")}
    >
      <div className={styles.body}>
        <div className={styles.header}>
          <div
            className={[styles.iconWrap, status === "error" ? styles.iconWrapError : ""]
              .filter(Boolean)
              .join(" ")}
          >
            {appIconEmoji(app.name)}
          </div>
          <span className={[styles.statusBadge, statusClass].join(" ")}>
            <span className={styles.statusDot} />
            {STATUS_LABELS[status]}
          </span>
        </div>
        <h3 className={styles.title}>{app.name}</h3>
        <p className={styles.description}>
          {app.description || "No description provided."}
        </p>
        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Package</span>
            <span className={styles.metaValue}>{slugifyPackageId(app.name)}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Version</span>
            <span className={styles.metaValue}>{version}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Updated</span>
            <span className={styles.metaValue}>{formatRelativeTime(app.ModifiedOn)}</span>
          </div>
        </div>
      </div>
      <footer
        className={[styles.footer, status === "error" ? styles.footerError : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {status === "error" ? (
          <button type="button" className={styles.actionError} onClick={handleOpenStudio}>
            View Logs
          </button>
        ) : null}
        <button type="button" className={styles.actionBtn} onClick={handleOpenStudio}>
          Open Studio
        </button>
        {status !== "error" ? (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setVersionsOpen(true)}
            data-testid="open-versions"
          >
            Versions
          </button>
        ) : null}
        {status === "published" ? (
          <div className={styles.runtimeMenuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="open-runtime"
              aria-expanded={menuOpen}
            >
              Open Runtime ▾
            </button>
            {menuOpen ? (
              <div className={styles.runtimeMenu} role="menu">
                <button
                  type="button"
                  className={styles.runtimeMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    openRuntime(app.id);
                  }}
                >
                  Published (global)
                </button>
                {promotedEnvs.map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    className={styles.runtimeMenuItem}
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      openRuntime(app.id, env.id);
                    }}
                  >
                    {env.name}
                    {env.current_version ? ` · ${env.current_version}` : ""}
                  </button>
                ))}
                {environments.length > 0 && promotedEnvs.length === 0 ? (
                  <div className={styles.runtimeMenuHint}>No promoted environments yet</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {status === "published" ? (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => void handleUnpublish()}
            disabled={unpublishing}
          >
            {unpublishing ? "Unpublishing…" : "Unpublish"}
          </button>
        ) : null}
        {status !== "error" ? (
          <button
            type="button"
            className={styles.actionPrimary}
            onClick={() => void handlePublish()}
            disabled={publishing}
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        ) : null}
      </footer>
      <VersionsModal
        open={versionsOpen}
        applicationId={app.id}
        applicationName={app.name}
        currentVersionId={app.current_version_id}
        onClose={() => setVersionsOpen(false)}
        onChanged={() => onPublishComplete?.()}
      />
    </article>
  );
}

export function NewAppCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.newCard} onClick={onClick}>
      <div className={styles.newIcon}>+</div>
      <h3 className={styles.newTitle}>New Application</h3>
      <p className={styles.newDesc}>Start building from a template or scratch.</p>
    </button>
  );
}
