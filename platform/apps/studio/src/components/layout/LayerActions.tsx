import { useApplicationStore } from "../../store/applicationStore";
import type { LayerAction } from "../../utils/layer-actions";
import styles from "./ExplorerPanel.module.css";

const ACTIONS: Array<{ action: LayerAction; label: string; testId: string }> = [
  { action: "bringForward", label: "↑ Bring Forward", testId: "explorer-layer-forward" },
  { action: "sendBackward", label: "↓ Send Backward", testId: "explorer-layer-backward" },
  { action: "bringToFront", label: "⇈ Bring To Front", testId: "explorer-layer-to-front" },
  { action: "sendToBack", label: "⇊ Send To Back", testId: "explorer-layer-to-back" },
];

export function LayerActions({ selectedControlId }: { selectedControlId: string }) {
  const applyLayerAction = useApplicationStore((s) => s.applyLayerAction);

  return (
    <div className={styles.layerActions} data-testid="explorer-layer-actions">
      {ACTIONS.map(({ action, label, testId }) => (
        <button
          key={action}
          type="button"
          className={styles.layerActionBtn}
          data-testid={testId}
          onClick={() => applyLayerAction(selectedControlId, action)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
