import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { useStudioStore } from "../../store/studioStore";
import { TopBar } from "./TopBar";
import { NavRail } from "./NavRail";
import { ExplorerPanel } from "./ExplorerPanel";
import { DataPanel } from "./DataPanel";
import { CanvasPanel } from "../canvas/CanvasPanel";
import { PropertyPanel } from "./PropertyPanel";
import { ToolsFooter } from "./ToolsFooter";
import { CommandPalette } from "./CommandPalette";
import { RuntimePreviewModal } from "../preview/RuntimePreviewModal";
import { ComponentLibrary } from "../library/ComponentLibrary";
import styles from "./StudioLayout.module.css";

export function StudioLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { applicationId: routeApplicationId } = useParams<{ applicationId?: string }>();
  const isLibraryView = location.pathname.startsWith("/studio/components");
  const propertiesCollapsed = useStudioStore((s) => s.propertiesCollapsed);
  const explorerCollapsed = useStudioStore((s) => s.explorerCollapsed);
  const sidePanelOpen = useStudioStore((s) => s.sidePanelOpen);
  const activeNavItem = useStudioStore((s) => s.activeNavItem);
  const dirty = useStudioStore((s) => s.dirty);
  const [previewOpen, setPreviewOpen] = useState(false);

  const applicationId = isLibraryView ? null : (routeApplicationId ?? null);

  // Nav rail (48) + side panel (300) or collapsed strip (32)
  const leftPaneCollapsedSize = 80;
  const leftPaneExpandedPreferred = 348;
  const leftPaneExpandedMin = 280;
  const leftPaneExpandedMax = 500;

  useEffect(() => {
    if (!isLibraryView && !routeApplicationId) {
      navigate("/studio", { replace: true });
    }
  }, [isLibraryView, routeApplicationId, navigate]);

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

  if (!isLibraryView && !routeApplicationId) {
    return null;
  }

  return (
    <div className={styles.root}>
      <TopBar
        onPreview={handlePreview}
        previewDisabled={!applicationId}
        applicationId={applicationId}
      />

      <div className={styles.workArea}>
        {isLibraryView ? (
          <ComponentLibrary />
        ) : (
          <Allotment proportionalLayout={false} className={styles.allotment}>
            <Allotment.Pane
              key={explorerCollapsed ? "explorer-collapsed" : "explorer-expanded"}
              preferredSize={
                explorerCollapsed ? leftPaneCollapsedSize : leftPaneExpandedPreferred
              }
              minSize={explorerCollapsed ? leftPaneCollapsedSize : leftPaneExpandedMin}
              maxSize={explorerCollapsed ? leftPaneCollapsedSize : leftPaneExpandedMax}
              snap
            >
              <div className={styles.leftPane}>
                <NavRail />
                <div
                  className={[
                    sidePanelOpen ? styles.sidePanel : styles.sidePanelHidden,
                    explorerCollapsed ? styles.sidePanelCollapsed : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {activeNavItem === "data" ? <DataPanel /> : <ExplorerPanel />}
                </div>
              </div>
            </Allotment.Pane>

            <Allotment.Pane minSize={320}>
              <CanvasPanel />
            </Allotment.Pane>

            <Allotment.Pane
              minSize={propertiesCollapsed ? 32 : 240}
              preferredSize={propertiesCollapsed ? 32 : 320}
              maxSize={propertiesCollapsed ? 32 : 480}
              snap
            >
              <PropertyPanel />
            </Allotment.Pane>
          </Allotment>
        )}
      </div>

      {!isLibraryView && <ToolsFooter />}
      <CommandPalette />
      <RuntimePreviewModal
        open={previewOpen}
        applicationId={applicationId}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
