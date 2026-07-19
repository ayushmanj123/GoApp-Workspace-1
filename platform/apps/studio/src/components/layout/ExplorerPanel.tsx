import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
import { ControlTree } from "./ControlTree";
import { InsertComponentModal } from "./InsertComponentModal";
import { TabBar, SearchInput } from "../ui";
import styles from "./ExplorerPanel.module.css";

const ChevronLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const AppIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ScreenIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const AddIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const PencilIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

interface RenameInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function RenameInput({ initialValue, onCommit, onCancel }: RenameInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      className={styles.renameInput}
      aria-label="Rename screen"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value.trim() || initialValue)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(value.trim() || initialValue);
        if (e.key === "Escape") onCancel();
      }}
    />
  );
}

export function ExplorerPanel() {
  const { applicationId: routeAppId, screenId: routeScreenId } = useParams<{
    applicationId?: string;
    screenId?: string;
  }>();
  const navigate = useNavigate();

  const collapsed = useStudioStore((s) => s.explorerCollapsed);
  const toggleExplorer = useStudioStore((s) => s.toggleExplorer);
  const activeNavItem = useStudioStore((s) => s.activeNavItem);
  const explorerTab = useStudioStore((s) => s.explorerTab);
  const setExplorerTab = useStudioStore((s) => s.setExplorerTab);
  const setActiveApp = useStudioStore((s) => s.setActiveApp);
  const setActiveScreen = useStudioStore((s) => s.setActiveScreen);
  const selectedControlId = useStudioStore((s) => s.selectedControlId);
  const selectControl = useStudioStore((s) => s.selectControl);

  const {
    applications,
    screens,
    controls,
    controlsLoading,
    selectedApplicationId,
    selectedScreenId,
    appsLoading,
    screensLoading,
    createScreenLoading,
    appsError,
    screensError,
    loadApplications,
    loadScreens,
    loadControls,
    selectApplication,
    selectScreen,
    createScreen,
    renameScreen,
    deleteScreen,
    componentDefinitions,
    componentDefinitionsLoading,
  } = useApplicationStore();

  const [renamingScreenId, setRenamingScreenId] = useState<string | null>(null);
  const [hoveredScreenId, setHoveredScreenId] = useState<string | null>(null);
  const [insertComponentOpen, setInsertComponentOpen] = useState(false);
  const [treeSearch, setTreeSearch] = useState("");

  const currentApp = routeAppId
    ? applications.find((a) => a.id === routeAppId)
    : null;

  const searchQuery = treeSearch.trim().toLowerCase();
  const filteredScreens = screens
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .filter((screen) => !searchQuery || screen.name.toLowerCase().includes(searchQuery));

  useEffect(() => {
    loadApplications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!routeAppId || applications.length === 0) return;
    const app = applications.find((a) => a.id === routeAppId);
    if (!app) return;

    if (selectedApplicationId !== routeAppId) {
      selectApplication(routeAppId);
      setActiveApp(routeAppId, app.name);
      loadScreens(routeAppId).then(() => {
        if (routeScreenId) selectScreen(routeScreenId);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeAppId, routeScreenId, applications.length]);

  useEffect(() => {
    if (!selectedScreenId) return;
    const screen = screens.find((s) => s.id === selectedScreenId);
    if (screen) setActiveScreen(screen.id, screen.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens, selectedScreenId]);

  useEffect(() => {
    if (!selectedScreenId) return;
    void loadControls(selectedScreenId);
  }, [selectedScreenId, loadControls]);

  const handleSelectScreen = (screen: { id: string; name: string }) => {
    selectScreen(screen.id);
    setActiveScreen(screen.id, screen.name);
    navigate(`/studio/apps/${selectedApplicationId}/screens/${screen.id}`);
  };

  const handleAddScreen = async () => {
    if (!selectedApplicationId) return;
    try {
      const screen = await createScreen(selectedApplicationId);
      await loadScreens(selectedApplicationId);
      handleSelectScreen(screen);
    } catch {
      // screensError is set in the store
    }
  };

  const handleRename = async (screenId: string, newName: string) => {
    setRenamingScreenId(null);
    if (!newName) return;
    await renameScreen(screenId, newName);
    if (selectedScreenId === screenId) setActiveScreen(screenId, newName);
  };

  const handleDelete = async (screenId: string, screenName: string) => {
    if (!confirm(`Delete screen "${screenName}"? This cannot be undone.`)) return;
    await deleteScreen(screenId);
  };

  const showExplorerContent =
    activeNavItem === "explorer" || activeNavItem === "insert";
  const showPagesTab = explorerTab === "pages" && activeNavItem !== "insert";
  const showComponentsTab =
    explorerTab === "components" || activeNavItem === "insert";

  return (
    <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.header}>
        {!collapsed && <span className={styles.title}>Explorer</span>}
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleExplorer}
          title={collapsed ? "Expand Explorer" : "Collapse Explorer"}
          aria-label={collapsed ? "Expand Explorer" : "Collapse Explorer"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      {!collapsed && showExplorerContent && (
        <>
          <TabBar
            tabs={[
              { id: "pages", label: "Pages" },
              { id: "components", label: "Components" },
            ]}
            activeTab={showComponentsTab ? "components" : "pages"}
            onTabChange={(tab) => setExplorerTab(tab as "pages" | "components")}
          />
          {showPagesTab && (
            <div className={styles.searchWrap}>
              <SearchInput
                fullWidth
                placeholder="Search tree…"
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
              />
            </div>
          )}
        </>
      )}

      {!collapsed && showExplorerContent && (
        <div className={styles.content}>
          {appsError && <div className={styles.errorMsg}>{appsError}</div>}
          {appsLoading && <div className={styles.loadingMsg}>Loading…</div>}

          {!appsLoading && showPagesTab && routeAppId && !currentApp && (
            <div className={styles.errorMsg}>
              <p>Application not found.</p>
              <Link to="/studio">Back to Apps</Link>
            </div>
          )}

          {!appsLoading && showPagesTab && currentApp && (
            <div className={styles.appNode}>
              <div className={`${styles.treeItem} ${styles.appSelected}`} title={currentApp.name}>
                <AppIcon />
                <span className={styles.treeItemLabel}>{currentApp.name}</span>
              </div>

              <div className={styles.screensSection}>
                <div className={styles.sectionHeader}>
                  <span>Screens</span>
                  <button
                    type="button"
                    className={styles.addBtn}
                    data-testid="add-screen-btn"
                    onClick={() => void handleAddScreen()}
                    title="New screen"
                    disabled={screensLoading || createScreenLoading}
                  >
                    <AddIcon />
                  </button>
                </div>

                {screensError && <div className={styles.errorMsg}>{screensError}</div>}
                {screensLoading && (
                  <div className={styles.loadingMsg}>Loading screens…</div>
                )}

                <ul className={styles.treeList}>
                  {filteredScreens.map((screen) => {
                    const isSelected = selectedScreenId === screen.id;
                    const isHovered = hoveredScreenId === screen.id;
                    const isRenaming = renamingScreenId === screen.id;

                    return (
                      <li
                        key={screen.id}
                        className={`${styles.screenItem} ${isSelected ? styles.active : ""}`}
                        onMouseEnter={() => setHoveredScreenId(screen.id)}
                        onMouseLeave={() => setHoveredScreenId(null)}
                      >
                        <div className={styles.screenRow}>
                          <button
                            type="button"
                            className={styles.screenBtn}
                            onClick={() => handleSelectScreen(screen)}
                          >
                            <ScreenIcon />
                            {isRenaming ? (
                              <RenameInput
                                initialValue={screen.name}
                                onCommit={(v) => void handleRename(screen.id, v)}
                                onCancel={() => setRenamingScreenId(null)}
                              />
                            ) : (
                              <span className={styles.treeItemLabel}>{screen.name}</span>
                            )}
                          </button>

                          {isHovered && !isRenaming && (
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                title="Rename"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingScreenId(screen.id);
                                }}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.danger}`}
                                title="Delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDelete(screen.id, screen.name);
                                }}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <div className={styles.screenChildren}>
                            {controlsLoading ? (
                              <div className={styles.loadingMsg}>Loading controls…</div>
                            ) : (
                              <ControlTree
                                controls={controls}
                                selectedControlId={selectedControlId}
                                onSelectControl={selectControl}
                                searchQuery={treeSearch}
                                nested
                              />
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}

                  {!screensLoading && screens.length === 0 && (
                    <li className={styles.emptyScreens}>No screens yet</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {showComponentsTab && (
            <div className={styles.componentsTab}>
              <div className={styles.sectionHeader}>
                <span>Definitions</span>
                <button
                  type="button"
                  className={styles.layerActionBtn}
                  title="Insert Component"
                  data-testid="explorer-insert-component"
                  onClick={() => setInsertComponentOpen(true)}
                >
                  + Insert
                </button>
              </div>
              {componentDefinitionsLoading ? (
                <div className={styles.loadingMsg}>Loading components…</div>
              ) : componentDefinitions.length === 0 ? (
                <div className={styles.emptyControls}>No reusable components yet</div>
              ) : (
                <ul className={styles.componentList}>
                  {componentDefinitions.map((definition) => (
                    <li
                      key={definition.id}
                      className={styles.componentItem}
                      data-testid={`explorer-component-def-${definition.name}`}
                    >
                      {definition.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <InsertComponentModal
            open={insertComponentOpen}
            onClose={() => setInsertComponentOpen(false)}
          />
        </div>
      )}
    </aside>
  );
}
