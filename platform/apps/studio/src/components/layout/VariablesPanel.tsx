import { useEffect, useState } from "react";
import { defaultVariableStore } from "../../../../runtime/src/formula/runtime-variable-store";
import styles from "./VariablesPanel.module.css";

export function VariablesPanel() {
  const [name, setName] = useState("");
  const [variables, setVariables] = useState(() => defaultVariableStore.getAll());

  useEffect(() => defaultVariableStore.subscribe(() => setVariables(defaultVariableStore.getAll())), []);

  const createVariable = () => {
    const next = name.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(next)) return;
    if (defaultVariableStore.get(next) !== undefined) return;
    defaultVariableStore.set(next, "");
    setName("");
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Variables</span>
      </div>
      <div className={styles.content}>
        <form
          className={styles.createRow}
          onSubmit={(event) => {
            event.preventDefault();
            createVariable();
          }}
        >
          <input
            className={styles.input}
            value={name}
            placeholder="Variable name"
            aria-label="Variable name"
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <button type="submit" className={styles.createBtn}>
            Create
          </button>
        </form>
        <ul className={styles.list}>
          {Object.keys(variables).map((variableName) => (
            <li key={variableName} className={styles.item}>
              <span>{variableName}</span>
              <button
                type="button"
                className={styles.deleteBtn}
                aria-label={`Delete ${variableName}`}
                onClick={() => defaultVariableStore.delete(variableName)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
