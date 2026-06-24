import { useApplicationStore } from "../../store/applicationStore";
import shellStyles from "../preview/RuntimePreviewModal.module.css";
import styles from "./InsertComponentModal.module.css";

interface InsertComponentModalProps {
  open: boolean;
  onClose: () => void;
}

export function InsertComponentModal({ open, onClose }: InsertComponentModalProps) {
  const componentDefinitions = useApplicationStore((s) => s.componentDefinitions);
  const insertComponentInstance = useApplicationStore((s) => s.insertComponentInstance);

  if (!open) {
    return null;
  }

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${styles.dialog}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Insert Component"
        data-testid="insert-component-modal"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Insert Component</div>
        </header>
        <div className={styles.body}>
          {componentDefinitions.length === 0 ? (
            <p className={styles.empty}>No component definitions yet.</p>
          ) : (
            <ul className={styles.list}>
              {componentDefinitions.map((definition) => (
                <li key={definition.id}>
                  <button
                    type="button"
                    className={styles.itemBtn}
                    data-testid={`insert-component-${definition.name}`}
                    onClick={() => {
                      insertComponentInstance(definition.id);
                      onClose();
                    }}
                  >
                    {definition.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            data-testid="insert-component-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
