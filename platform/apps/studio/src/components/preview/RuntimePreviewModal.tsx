import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RuntimeProvider } from "../../../../runtime/src/runtime-provider";
import RuntimeRenderer from "../../../../runtime/src/runtime-renderer";
import registerRuntime from "../../../../runtime/src/registry-bridge";
import { useRuntime } from "../../../../runtime/src/runtime-hooks";
import { useApplicationStore } from "../../store/applicationStore";
import { useStudioStore } from "../../store/studioStore";
import styles from "./RuntimePreviewModal.module.css";

registerRuntime();

interface RuntimePreviewModalProps {
  open: boolean;
  applicationId: string | null;
  onClose: () => void;
}

function RuntimePreviewContent({
  selectedScreenId,
}: {
  selectedScreenId: string | null;
}) {
  const { pkg, loading, navigate } = useRuntime();
  const initialized = useRef(false);

  useEffect(() => {
    if (loading || !pkg || initialized.current) {
      return;
    }

    const targetScreenId = selectedScreenId ?? pkg.screens?.[0]?.id;
    if (targetScreenId) {
      navigate(targetScreenId);
      initialized.current = true;
    }
  }, [loading, pkg, selectedScreenId, navigate]);

  return <RuntimeRenderer />;
}

export function RuntimePreviewModal({
  open,
  applicationId,
  onClose,
}: RuntimePreviewModalProps) {
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const activeScreenId = useStudioStore((s) => s.activeScreenId);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <div className={styles.title}>Runtime Preview</div>
            <div className={styles.subtitle}>
              Read-only preview of the current application
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </header>

        <div className={styles.body}>
          {!applicationId ? (
            <div className={styles.emptyState}>
              Select an application to preview.
            </div>
          ) : (
            <RuntimeProvider appId={applicationId} channel="draft">
              <RuntimePreviewContent
                selectedScreenId={selectedScreenId ?? activeScreenId}
              />
            </RuntimeProvider>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
