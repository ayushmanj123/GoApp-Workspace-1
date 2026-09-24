import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
import { useHistoryStore } from "../../store/historyStore";
import { publishApi } from "../../api/publish-api";
import { isEditableKeyboardTarget } from "../../utils/editable-keyboard-target";
import { Avatar, Button, IconButton, SearchInput } from "../ui";
import { IconRedo, IconSave, IconUndo } from "../ui/icons";
import styles from "./TopBar.module.css";

interface TopBarProps {
  onPreview: () => void;
  previewDisabled?: boolean;
  applicationId?: string | null;
}

const ZOOM_OPTIONS = [25, 50, 75, 100, 125, 150, 200];

export function TopBar({
  onPreview,
  previewDisabled = false,
  applicationId = null,
}: TopBarProps) {
  const location = useLocation();
  const appName = useStudioStore((s) => s.appName);
  const saving = useStudioStore((s) => s.saving);
  const zoom = useStudioStore((s) => s.zoom);
  const setZoom = useStudioStore((s) => s.setZoom);
  const setCommandPaletteOpen = useStudioStore((s) => s.setCommandPaletteOpen);
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const editingDefinitionId = useApplicationStore((s) => s.editingDefinitionId);
  const controls = useApplicationStore((s) => s.controls);
  const setControls = useApplicationStore((s) => s.setControlsFromHistory);
  const saveScreen = useApplicationStore((s) => s.saveScreen);
  const saveComponentDefinition = useApplicationStore((s) => s.saveComponentDefinition);
  const setSaving = useStudioStore((s) => s.setSaving);
  const setSaveMessage = useStudioStore((s) => s.setSaveMessage);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const [publishing, setPublishing] = useState(false);

  const isComponents = location.pathname.startsWith("/studio/components");

  const handleSave = useCallback(async () => {
    if (saving || (!selectedScreenId && !editingDefinitionId)) return;
    setSaving(true);
    try {
      const result = editingDefinitionId
        ? await saveComponentDefinition()
        : await saveScreen();
      setSaveMessage(result.success ? "Changes saved" : "Save failed");
    } catch {
      setSaveMessage("Save failed");
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    selectedScreenId,
    editingDefinitionId,
    saveScreen,
    saveComponentDefinition,
    setSaving,
    setSaveMessage,
  ]);

  const handlePublish = useCallback(async () => {
    if (!applicationId || publishing) return;
    const confirmed = window.confirm(
      "Publish this application? A new immutable runtime version will be created.",
    );
    if (!confirmed) return;
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

  const handleUndo = () => {
    const restored = undo(controls);
    if (restored) setControls(restored);
  };

  const handleRedo = () => {
    const restored = redo(controls);
    if (restored) setControls(restored);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Don't steal keys from property/formula editors (including Ctrl+Z text undo).
      if (isEditableKeyboardTarget(event.target)) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        void handleSave();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, controls]);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <Link to="/studio" className={styles.logo} title="Back to Apps">
          GoApps Studio
        </Link>
        {!isComponents && applicationId ? (
          <>
            <div className={styles.dividerVertical} />
            <span className={styles.appName}>{appName}</span>
          </>
        ) : null}
        {isComponents ? (
          <>
            <div className={styles.dividerVertical} />
            <span className={styles.appName}>Component Library</span>
          </>
        ) : null}
      </div>

      <div className={styles.center}>
        <button type="button" onClick={() => setCommandPaletteOpen(true)}>
          <SearchInput
            readOnly
            placeholder="Command Palette (Ctrl+K)"
            shortcut="⌘K"
            fullWidth
            onClick={() => setCommandPaletteOpen(true)}
          />
        </button>
      </div>

      <div className={styles.right}>
        <IconButton title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={handleUndo}>
          <IconUndo />
        </IconButton>
        <IconButton title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={handleRedo}>
          <IconRedo />
        </IconButton>
        <div className={styles.divider} />
        <select
          className={styles.zoomSelect}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom level"
        >
          {ZOOM_OPTIONS.map((z) => (
            <option key={z} value={z}>
              {z}%
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || !selectedScreenId}
        >
          <IconSave size={14} />
          {saving ? "Saving…" : "Save"}
        </Button>
        {!previewDisabled && (
          <Button variant="ghost" size="sm" onClick={onPreview}>
            Preview
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handlePublish()}
          disabled={!applicationId || publishing}
          data-testid="publish-application"
        >
          {publishing ? "Publishing…" : "Publish"}
        </Button>
        <Avatar initials="AJ" title="Signed in" />
      </div>
    </header>
  );
}
