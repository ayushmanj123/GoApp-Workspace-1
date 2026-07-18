import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useApplicationStore } from "../../store/applicationStore";
import { useStudioStore } from "../../store/studioStore";
import { SearchInput } from "../ui/SearchInput";
import styles from "./CommandPalette.module.css";

interface CommandItem {
  id: string;
  label: string;
  category: string;
  action: () => void;
}

export function CommandPalette() {
  const open = useStudioStore((s) => s.commandPaletteOpen);
  const setOpen = useStudioStore((s) => s.setCommandPaletteOpen);
  const screens = useApplicationStore((s) => s.screens);
  const controls = useApplicationStore((s) => s.controls);
  const selectedApplicationId = useApplicationStore((s) => s.selectedApplicationId);
  const selectScreen = useApplicationStore((s) => s.selectScreen);
  const selectControl = useStudioStore((s) => s.selectControl);
  const navigate = useNavigate();
  const location = useLocation();
  const { applicationId: routeApplicationId } = useParams<{ applicationId?: string }>();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const scopedApplicationId = routeApplicationId ?? selectedApplicationId;

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    if (scopedApplicationId) {
      for (const screen of screens) {
        list.push({
          id: `screen-${screen.id}`,
          label: screen.name,
          category: "Screen",
          action: () => {
            navigate(`/studio/apps/${scopedApplicationId}/screens/${screen.id}`);
            selectScreen(screen.id);
          },
        });
      }

      for (const control of controls) {
        list.push({
          id: `control-${control.id}`,
          label: control.name,
          category: control.control_type,
          action: () => selectControl(control.id),
        });
      }
    }

    if (location.pathname.startsWith("/studio/components")) {
      list.push({
        id: "nav-studio",
        label: "Back to Apps",
        category: "Navigation",
        action: () => navigate("/studio"),
      });
    }

    return list;
  }, [
    scopedApplicationId,
    screens,
    controls,
    navigate,
    selectScreen,
    selectControl,
    location.pathname,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Enter" && filtered[selectedIndex]) {
        event.preventDefault();
        filtered[selectedIndex].action();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, selectedIndex, setOpen]);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className={styles.searchWrap}>
          <SearchInput
            ref={inputRef}
            fullWidth
            placeholder="Search screens, controls, and commands…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>
        <div className={styles.results}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No results found</div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={styles.resultItem}
                data-selected={index === selectedIndex}
                onClick={() => {
                  item.action();
                  setOpen(false);
                }}
              >
                <span>{item.label}</span>
                <span className={styles.resultMeta}>{item.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
