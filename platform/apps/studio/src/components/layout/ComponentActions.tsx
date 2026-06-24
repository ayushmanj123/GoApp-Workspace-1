import { useState } from "react";
import { useApplicationStore } from "../../store/applicationStore";
import styles from "./ExplorerPanel.module.css";

export function ComponentActions({ selectedControlId }: { selectedControlId: string }) {
  const createComponentFromSelection = useApplicationStore(
    (s) => s.createComponentFromSelection,
  );
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className={styles.layerActions} data-testid="explorer-component-actions">
        <button
          type="button"
          className={styles.layerActionBtn}
          data-testid="explorer-create-component"
          onClick={() => setOpen(true)}
        >
          Create Component
        </button>
      </div>
    );
  }

  return (
    <div className={styles.componentCreateRow} data-testid="explorer-create-component-form">
      <input
        className={styles.renameInput}
        data-testid="explorer-create-component-name"
        placeholder="Component name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="button"
        className={styles.layerActionBtn}
        data-testid="explorer-create-component-save"
        onClick={() => {
          const trimmed = name.trim();
          if (!trimmed) {
            return;
          }
          void createComponentFromSelection(selectedControlId, trimmed).then(() => {
            setName("");
            setOpen(false);
          });
        }}
      >
        Save
      </button>
      <button
        type="button"
        className={styles.layerActionBtn}
        data-testid="explorer-create-component-cancel"
        onClick={() => {
          setName("");
          setOpen(false);
        }}
      >
        Cancel
      </button>
    </div>
  );
}
