import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import shellStyles from "../preview/RuntimePreviewModal.module.css";
import styles from "./FormulaEditorModal.module.css";

interface FormulaEditorModalProps {
  open: boolean;
  propertyLabel: string;
  initialFormula: string;
  onSave: (formula: string) => void;
  onCancel: () => void;
}

export function FormulaEditorModal({
  open,
  propertyLabel,
  initialFormula,
  onSave,
  onCancel,
}: FormulaEditorModalProps) {
  const [draft, setDraft] = useState(initialFormula);

  useEffect(() => {
    if (open) {
      setDraft(initialFormula);
    }
  }, [open, initialFormula]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className={shellStyles.overlay} onMouseDown={onCancel}>
      <div
        className={`${shellStyles.dialog} ${styles.dialog}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Formula Editor"
      >
        <header className={shellStyles.header}>
          <div>
            <div className={shellStyles.title}>Formula Editor</div>
            <div className={shellStyles.subtitle}>{propertyLabel}</div>
          </div>
        </header>

        <div className={styles.body}>
          <textarea
            className={styles.textarea}
            data-testid="formula-editor-input"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            autoFocus
          />
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            data-testid="formula-editor-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            data-testid="formula-editor-save"
            onClick={() => onSave(draft)}
          >
            Save
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
