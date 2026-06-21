import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
import styles from "./ExplorerPanel.module.css";

// ── Icons ────────────────────────────────────────────────────────────────────

const ChevronLeftIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const AppIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ScreenIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const AddIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const PencilIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

// ── Inline rename input ───────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export function ExplorerPanel() {
  const { applicationId: routeAppId, screenId: routeScreenId } = useParams<{
    applicationId?: string;
    screenId?: string;
  }>();
  const navigate = useNavigate();

  const collapsed = useStudioStore((s) => s.explorerCollapsed);
  const toggleExplorer = useStudioStore((s) => s.toggleExplorer);
  const setActiveApp = useStudioStore((s) => s.setActiveApp);
  const setActiveScreen = useStudioStore((s) => s.setActiveScreen);

  const {
    applications,
    screens,
    selectedApplicationId,
    selectedScreenId,
    appsLoading,
    screensLoading,
    appsError,
    screensError,
    loadApplications,
    loadScreens,
    selectApplication,
    selectScreen,
    createScreen,
    renameScreen,
    deleteScreen,
  } = useApplicationStore();

  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [renamingScreenId, setRenamingScreenId] = useState<string | null>(null);
  const [hoveredScreenId, setHoveredScreenId] = useState<string | null>(null);

  // Load apps once on mount
  useEffect(() => {
    loadApplications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore from URL once apps are loaded
  useEffect(() => {
    if (!routeAppId || applications.length === 0) return;
    const app = applications.find((a) => a.id === routeAppId);
    if (!app) return;

    if (selectedApplicationId !== routeAppId) {
      selectApplication(routeAppId);
      setActiveApp(routeAppId, app.name);
      setExpandedApps(new Set([routeAppId]));
      loadScreens(routeAppId).then(() => {
        if (routeScreenId) selectScreen(routeScreenId);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeAppId, routeScreenId, applications.length]);

  // Auto-select first app if no URL context
  useEffect(() => {
    if (selectedApplicationId || applications.length === 0 || routeAppId)
      return;
    const first = applications[0];
    selectApplication(first.id);
    setActiveApp(first.id, first.name);
    setExpandedApps(new Set([first.id]));
    loadScreens(first.id);
    navigate(`/studio/apps/${first.id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications.length]);

  // Keep studioStore screenName in sync
  useEffect(() => {
    if (!selectedScreenId) return;
    const screen = screens.find((s) => s.id === selectedScreenId);
    if (screen) setActiveScreen(screen.id, screen.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens, selectedScreenId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectApp = (app: { id: string; name: string }) => {
    setExpandedApps((prev) => {
      const next = new Set(prev);
      if (selectedApplicationId === app.id) {
        next.has(app.id) ? next.delete(app.id) : next.add(app.id);
        return next;
      }
      next.add(app.id);
      return next;
    });
    if (selectedApplicationId !== app.id) {
      selectApplication(app.id);
      setActiveApp(app.id, app.name);
      loadScreens(app.id);
      navigate(`/studio/apps/${app.id}`, { replace: true });
    }
  };

  const handleSelectScreen = (screen: { id: string; name: string }) => {
    selectScreen(screen.id);
    setActiveScreen(screen.id, screen.name);
    navigate(`/studio/apps/${selectedApplicationId}/screens/${screen.id}`);
  };

  const handleAddScreen = async () => {
    if (!selectedApplicationId) return;
    const count = screens.length + 1;
    const screen = await createScreen(selectedApplicationId, `Screen${count}`);
    handleSelectScreen(screen);
  };

  const handleRename = async (screenId: string, newName: string) => {
    setRenamingScreenId(null);
    if (!newName) return;
    await renameScreen(screenId, newName);
    if (selectedScreenId === screenId) setActiveScreen(screenId, newName);
  };

  const handleDelete = async (screenId: string, screenName: string) => {
    if (!confirm(`Delete screen "${screenName}"? This cannot be undone.`))
      return;
    await deleteScreen(screenId);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ""}`}>
      {/* Header */}
      <div className={styles.header}>
        {!collapsed && <span className={styles.title}>Explorer</span>}
        <button
          className={styles.collapseBtn}
          onClick={toggleExplorer}
          title={collapsed ? "Expand Explorer" : "Collapse Explorer"}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      {!collapsed && (
        <div className={styles.content}>
          {appsError && <div className={styles.errorMsg}>{appsError}</div>}
          {appsLoading && <div className={styles.loadingMsg}>Loading…</div>}

          {!appsLoading &&
            applications.map((app) => {
              const isExpanded = expandedApps.has(app.id);
              const isSelectedApp = selectedApplicationId === app.id;

              return (
                <div key={app.id} className={styles.appNode}>
                  <button
                    className={`${styles.treeItem} ${isSelectedApp ? styles.appSelected : ""}`}
                    onClick={() => handleSelectApp(app)}
                    title={app.name}
                  >
                    <span className={styles.treeItemChevron}>
                      {isExpanded ? "▾" : "▸"}
                    </span>
                    <AppIcon />
                    <span className={styles.treeItemLabel}>{app.name}</span>
                  </button>

                  {isExpanded && (
                    <div className={styles.screensSection}>
                      <div className={styles.sectionHeader}>
                        <span>Screens</span>
                        <button
                          className={styles.addBtn}
                          onClick={() => {
                            void handleAddScreen();
                          }}
                          title="New screen"
                          disabled={screensLoading}
                        >
                          <AddIcon />
                        </button>
                      </div>

                      {screensError && (
                        <div className={styles.errorMsg}>{screensError}</div>
                      )}
                      {screensLoading && (
                        <div className={styles.loadingMsg}>
                          Loading screens…
                        </div>
                      )}

                      <ul className={styles.treeList}>
                        {screens
                          .slice()
                          .sort((a, b) => a.display_order - b.display_order)
                          .map((screen) => {
                            const isSelected = selectedScreenId === screen.id;
                            const isHovered = hoveredScreenId === screen.id;
                            const isRenaming = renamingScreenId === screen.id;

                            return (
                              <li
                                key={screen.id}
                                className={`${styles.screenItem} ${isSelected ? styles.active : ""}`}
                                onMouseEnter={() =>
                                  setHoveredScreenId(screen.id)
                                }
                                onMouseLeave={() => setHoveredScreenId(null)}
                              >
                                <button
                                  className={styles.screenBtn}
                                  onClick={() => handleSelectScreen(screen)}
                                >
                                  <ScreenIcon />
                                  {isRenaming ? (
                                    <RenameInput
                                      initialValue={screen.name}
                                      onCommit={(v) => {
                                        void handleRename(screen.id, v);
                                      }}
                                      onCancel={() => setRenamingScreenId(null)}
                                    />
                                  ) : (
                                    <span className={styles.treeItemLabel}>
                                      {screen.name}
                                    </span>
                                  )}
                                </button>

                                {isHovered && !isRenaming && (
                                  <div className={styles.rowActions}>
                                    <button
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
                                      className={`${styles.actionBtn} ${styles.danger}`}
                                      title="Delete"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleDelete(
                                          screen.id,
                                          screen.name,
                                        );
                                      }}
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                )}
                              </li>
                            );
                          })}

                        {!screensLoading && screens.length === 0 && (
                          <li className={styles.emptyScreens}>
                            No screens yet
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </aside>
  );
}
