import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import shellStyles from "../preview/RuntimePreviewModal.module.css";
import styles from "./FormulaEditorModal.module.css";
import {
  FORMULA_EDITOR_LANGUAGE,
  setupMonacoFormulaEditor,
} from "./setup-monaco-formula";
import {
  validateFormula,
  type FormulaValidationMode,
} from "./validate-formula";

interface FormulaEditorModalProps {
  open: boolean;
  propertyLabel: string;
  initialFormula: string;
  validationMode?: FormulaValidationMode;
  evaluationContext?: Record<string, unknown>;
  onSave: (formula: string) => void;
  onCancel: () => void;
}

type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

export function FormulaEditorModal({
  open,
  propertyLabel,
  initialFormula,
  validationMode = "expression",
  evaluationContext,
  onSave,
  onCancel,
}: FormulaEditorModalProps) {
  const [draft, setDraft] = useState(initialFormula);
  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const syncInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialFormula);
      setValidationStatus("idle");
      setValidationError(null);
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

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      setValidationStatus("idle");
      setValidationError(null);
      return;
    }

    setValidationStatus("validating");
    const timeoutId = window.setTimeout(() => {
      void validateFormula(trimmed, {
        mode: validationMode,
        context: evaluationContext,
      }).then((result) => {
        setValidationStatus(result.ok ? "valid" : "invalid");
        setValidationError(result.error ?? null);
      });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [draft, open, validationMode, evaluationContext]);

  if (!open) {
    return null;
  }

  const helperText =
    validationMode === "action"
      ? "Action formulas run in Runtime. Use Set, Navigate, UpdateContext, Collect, ClearCollect, Clear, Patch, Remove, Defaults, SubmitForm, ResetForm, NewForm, EditForm, ViewForm, Back, LookUp, Filter — chain with ;."
      : "Expression formulas resolve at design time when the formula engine is available. Custom variables must be created with Set() in Preview.";

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
          <p className={styles.helperText}>{helperText}</p>
          <textarea
            ref={syncInputRef}
            className={styles.syncInput}
            data-testid="formula-editor-input"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            tabIndex={-1}
            aria-hidden="true"
          />
          <div
            className={styles.editorShell}
            data-testid="formula-editor-monaco"
          >
            <Editor
              height="200px"
              language={FORMULA_EDITOR_LANGUAGE}
              theme="vs-dark"
              value={draft}
              onChange={(value) => setDraft(value ?? "")}
              beforeMount={setupMonacoFormulaEditor}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                tabSize: 2,
              }}
            />
          </div>
          {validationStatus === "valid" ? (
            <div
              className={styles.statusValid}
              data-testid="formula-editor-status-valid"
            >
              ✓ Formula Valid
            </div>
          ) : null}
          {validationStatus === "invalid" ? (
            <div
              className={styles.statusInvalid}
              data-testid="formula-editor-status-error"
            >
              ✗ {validationError ?? "Formula Error"}
            </div>
          ) : null}
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
