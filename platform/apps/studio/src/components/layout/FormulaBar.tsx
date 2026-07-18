import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { useStudioStore } from "../../store/studioStore";
import {
  FORMULA_EDITOR_LANGUAGE,
  setupMonacoFormulaEditor,
} from "../formula/setup-monaco-formula";
import { validateFormula } from "../formula/validate-formula";
import styles from "./FormulaBar.module.css";

type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

export function FormulaBar() {
  const context = useStudioStore((s) => s.formulaBarContext);
  const expanded = useStudioStore((s) => s.formulaBarExpanded);
  const setExpanded = useStudioStore((s) => s.setFormulaBarExpanded);
  const setFormulaCursor = useStudioStore((s) => s.setFormulaCursor);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ValidationStatus>("idle");

  useEffect(() => {
    if (context) {
      setDraft(context.formula);
      setStatus("idle");
    } else {
      setDraft("");
    }
  }, [context]);

  useEffect(() => {
    if (!context) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setStatus("idle");
      return;
    }
    setStatus("validating");
    const timeoutId = window.setTimeout(() => {
      void validateFormula(trimmed, {
        mode: context.validationMode,
        evaluationContext: {},
      }).then((result) => {
        setStatus(result.valid ? "valid" : "invalid");
      });
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [draft, context]);

  const handleSave = () => {
    if (context) {
      context.onSave(draft);
    }
  };

  return (
    <div className={styles.bar} data-testid="formula-bar">
      <div className={styles.label}>
        <span className={styles.fx}>fx</span>
        <span>Formula Bar</span>
      </div>
      {context ? (
        <>
          <div className={styles.editorWrap}>
            <Editor
              height={expanded ? "120px" : "38px"}
              language={FORMULA_EDITOR_LANGUAGE}
              value={draft}
              theme="vs"
              beforeMount={setupMonacoFormulaEditor}
              onChange={(value) => setDraft(value ?? "")}
              onMount={(editor) => {
                editor.onDidChangeCursorPosition((e) => {
                  setFormulaCursor({
                    line: e.position.lineNumber,
                    column: e.position.column,
                  });
                });
              }}
              options={{
                minimap: { enabled: false },
                lineNumbers: expanded ? "on" : "off",
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                fontSize: 12,
                fontFamily: "JetBrains Mono, monospace",
                padding: { top: 8, bottom: 8 },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                renderLineHighlight: "none",
                wordWrap: "on",
              }}
            />
          </div>
          <div className={styles.actions}>
            {status === "valid" ? <span className={styles.valid} title="Valid" /> : null}
            {status === "invalid" ? <span className={styles.error} title="Invalid formula" /> : null}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Collapse" : "Expand"}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Apply
            </Button>
            <Button variant="ghost" size="sm">
              AI Formula
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          Select a formula property to edit — e.g. Filter(SalesData, Region=&quot;North&quot;)
        </div>
      )}
    </div>
  );
}
