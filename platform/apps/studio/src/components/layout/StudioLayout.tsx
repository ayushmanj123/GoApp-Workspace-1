import { useMemo, useState } from "react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
import { TopBar } from "./TopBar";
import { ExplorerPanel } from "./ExplorerPanel";
import { CanvasPanel } from "../canvas/CanvasPanel";
import { PropertyPanel } from "./PropertyPanel";
import { StatusBar } from "./StatusBar";
import { RuntimePreviewModal } from "../preview/RuntimePreviewModal";
import styles from "./StudioLayout.module.css";

export function StudioLayout() {
  const explorerCollapsed = useStudioStore((s) => s.explorerCollapsed);
  const propertiesCollapsed = useStudioStore((s) => s.propertiesCollapsed);
  const activeAppId = useStudioStore((s) => s.activeAppId);
  const dirty = useStudioStore((s) => s.dirty);
  const selectedApplicationId = useApplicationStore(
    (s) => s.selectedApplicationId,
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  const applicationId = useMemo(
    () => selectedApplicationId ?? activeAppId,
    [selectedApplicationId, activeAppId],
  );

  const handlePreview = () => {
    if (dirty) {
      const proceed = window.confirm(
        "You have unsaved changes. Save before preview?",
      );
      if (!proceed) {
        return;
      }
    }
    setPreviewOpen(true);
  };

  return (
    <div className={styles.root}>
      <TopBar
        onPreview={handlePreview}
        previewDisabled={!applicationId}
        applicationId={applicationId}
      />

      <div className={styles.workArea}>
        <Allotment proportionalLayout={false}>
          {/* Explorer */}
          <Allotment.Pane
            minSize={explorerCollapsed ? 32 : 160}
            preferredSize={explorerCollapsed ? 32 : 220}
            maxSize={explorerCollapsed ? 32 : 400}
            snap
          >
            <ExplorerPanel />
          </Allotment.Pane>

          {/* Canvas */}
          <Allotment.Pane minSize={320}>
            <CanvasPanel />
          </Allotment.Pane>

          {/* Properties */}
          <Allotment.Pane
            minSize={propertiesCollapsed ? 32 : 200}
            preferredSize={propertiesCollapsed ? 32 : 260}
            maxSize={propertiesCollapsed ? 32 : 480}
            snap
          >
            <PropertyPanel />
          </Allotment.Pane>
        </Allotment>
      </div>

      <StatusBar />
      <RuntimePreviewModal
        open={previewOpen}
        applicationId={applicationId}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
