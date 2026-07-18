import {
  IconAI,
  IconAssets,
  IconData,
  IconExplorer,
  IconInsert,
  IconPlugins,
  IconThemes,
  IconVariables,
} from "../ui/icons";
import { useStudioStore, type NavRailItem } from "../../store/studioStore";
import styles from "./NavRail.module.css";

const NAV_ITEMS: { id: NavRailItem; label: string; icon: React.ReactNode }[] = [
  { id: "explorer", label: "Explorer", icon: <IconExplorer /> },
  { id: "insert", label: "Insert", icon: <IconInsert /> },
  { id: "assets", label: "Assets", icon: <IconAssets /> },
  { id: "variables", label: "Variables", icon: <IconVariables /> },
  { id: "data", label: "Data", icon: <IconData /> },
  { id: "themes", label: "Themes", icon: <IconThemes /> },
  { id: "plugins", label: "Plugins", icon: <IconPlugins /> },
  { id: "ai", label: "AI", icon: <IconAI /> },
];

export function NavRail() {
  const activeNavItem = useStudioStore((s) => s.activeNavItem);
  const setActiveNavItem = useStudioStore((s) => s.setActiveNavItem);
  const setExplorerTab = useStudioStore((s) => s.setExplorerTab);

  const handleClick = (id: NavRailItem) => {
    setActiveNavItem(id);
    if (id === "insert") {
      setExplorerTab("components");
    } else if (id === "explorer") {
      setExplorerTab("pages");
    }
  };

  return (
    <nav className={styles.rail} aria-label="Navigation">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={[styles.item, activeNavItem === item.id ? styles.active : ""]
            .filter(Boolean)
            .join(" ")}
          title={item.label}
          aria-label={item.label}
          aria-current={activeNavItem === item.id ? "page" : undefined}
          onClick={() => handleClick(item.id)}
        >
          {item.icon}
        </button>
      ))}
      <div className={styles.spacer} />
    </nav>
  );
}
