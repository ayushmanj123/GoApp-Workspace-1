import { useCallback, useEffect, useState } from "react";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
import { publishApi } from "../../api/publish-api";
import styles from "./TopBar.module.css";

const UndoIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
  </svg>
);

const RedoIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13" />
  </svg>
);

const SaveIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const PreviewIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const PublishIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 19V5" />
    <polyline points="5 12 12 5 19 12" />
    <line x1="4" y1="21" x2="20" y2="21" />
  </svg>
);

interface TopBarProps {
  onPreview: () => void;
  previewDisabled?: boolean;
  applicationId?: string | null;
}

export function TopBar({
  onPreview,
  previewDisabled = false,
  applicationId = null,
}: TopBarProps) {
  const appName = useStudioStore((s) => s.appName);
  const saving = useStudioStore((s) => s.saving);
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const saveScreen = useApplicationStore((s) => s.saveScreen);
  const setSaving = useStudioStore((s) => s.setSaving);
  const setSaveMessage = useStudioStore((s) => s.setSaveMessage);
  const [publishing, setPublishing] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving || !selectedScreenId) {
      return;
    }

    setSaving(true);
    try {
      const result = await saveScreen();
      setSaveMessage(result.success ? "Changes saved" : "Save failed");
    } catch {
      setSaveMessage("Save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, selectedScreenId, saveScreen, setSaving, setSaveMessage]);

  const handlePublish = useCallback(async () => {
    if (!applicationId || publishing) {
      return;
    }
    const confirmed = window.confirm(
      "Publish this application? A new immutable runtime version will be created.",
    );
    if (!confirmed) {
      return;
    }

    setPublishing(true);
    try {
      const result = await publishApi.publish(applicationId);
      setSaveMessage(`Published v${result.version}`);
    } catch {
      setSaveMessage("Publish failed");
    } finally {
      setPublishing(false);
    }
  }, [applicationId, publishing, setSaveMessage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        void handleSave();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  return (
    <header className={styles.topbar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoMark}>GA</span>
        <span className={styles.logoText}>Studio</span>
      </div>

      {/* App name */}
      <div className={styles.appName} title={appName}>
        {appName}
      </div>

      {/* Toolbar actions */}
      <div className={styles.toolbar}>
        <button className={styles.iconBtn} title="Undo (Ctrl+Z)">
          <UndoIcon />
        </button>
        <button className={styles.iconBtn} title="Redo (Ctrl+Y)">
          <RedoIcon />
        </button>

        <div className={styles.divider} />

        <button
          className={styles.iconBtn}
          title="Save (Ctrl+S)"
          onClick={() => void handleSave()}
          disabled={saving || !selectedScreenId}
        >
          <SaveIcon />
          <span>{saving ? "Saving…" : "Save"}</span>
        </button>
        <button
          className={styles.iconBtn}
          title="Preview"
          onClick={onPreview}
          disabled={previewDisabled}
        >
          <PreviewIcon />
          <span>Preview</span>
        </button>

        <div className={styles.divider} />

        <button
          className={styles.publishBtn}
          title="Publish application"
          onClick={() => void handlePublish()}
          disabled={!applicationId || publishing}
          data-testid="publish-application"
        >
          <PublishIcon />
          <span>{publishing ? "Publishing…" : "Publish"}</span>
        </button>
      </div>

      {/* User avatar */}
      <div className={styles.avatar} title="Signed in">
        <span>U</span>
      </div>
    </header>
  );
}
