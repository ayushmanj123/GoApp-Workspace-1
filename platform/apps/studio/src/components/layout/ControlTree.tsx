import { useEffect, useMemo, useState } from "react";
import type { Control } from "../../api/controls-api";
import { buildControlTree, type ControlTreeNode } from "../../utils/build-control-tree";
import styles from "./ExplorerPanel.module.css";

interface ControlTreeProps {
  controls: Control[];
  selectedControlId: string | null;
  onSelectControl: (controlId: string) => void;
  searchQuery?: string;
  nested?: boolean;
}

function ControlTreeNodeRow({
  node,
  depth,
  basePadding,
  selectedControlId,
  expandedIds,
  onToggleExpand,
  onSelectControl,
}: {
  node: ControlTreeNode;
  depth: number;
  basePadding: number;
  selectedControlId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (controlId: string) => void;
  onSelectControl: (controlId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedControlId === node.id;

  return (
    <>
      <li
        className={`${styles.controlItem} ${isSelected ? styles.controlSelected : ""}`}
        data-testid={`explorer-control-${node.id}`}
        data-selected={isSelected ? "true" : "false"}
        data-depth={depth}
        style={{ paddingLeft: `${basePadding + depth * 18}px` }}
        data-indent-depth={depth}
      >
        {hasChildren ? (
          <button
            type="button"
            className={styles.controlChevronBtn}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            data-testid={`explorer-expand-${node.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className={styles.controlChevronSpacer} />
        )}
        <button
          type="button"
          className={styles.controlBtn}
          data-testid={`explorer-select-${node.id}`}
          onClick={() => onSelectControl(node.id)}
        >
          <span className={styles.controlName}>{node.name}</span>
          {node.control_type === "component" ? (
            <span className={styles.componentBadge} data-testid={`explorer-component-instance-${node.id}`}>
              component
            </span>
          ) : null}
          <span className={styles.controlZIndex}>(z: {node.z_index})</span>
        </button>
      </li>
      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <ControlTreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              basePadding={basePadding}
              selectedControlId={selectedControlId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelectControl={onSelectControl}
            />
          ))
        : null}
    </>
  );
}

export function ControlTree({
  controls,
  selectedControlId,
  onSelectControl,
  searchQuery = "",
  nested = false,
}: ControlTreeProps) {
  const basePadding = nested ? 36 : 28;
  const tree = useMemo(() => buildControlTree(controls), [controls]);
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tree;
    const filterNode = (node: ControlTreeNode): ControlTreeNode | null => {
      const childMatches = node.children
        .map(filterNode)
        .filter((c): c is ControlTreeNode => c !== null);
      const selfMatch = node.name.toLowerCase().includes(q);
      if (selfMatch || childMatches.length > 0) {
        return { ...node, children: childMatches.length > 0 ? childMatches : node.children };
      }
      return null;
    };
    return tree.map(filterNode).filter((n): n is ControlTreeNode => n !== null);
  }, [tree, searchQuery]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const parentIds = controls
      .filter((control) =>
        controls.some((child) => child.parent_control_id === control.id),
      )
      .map((control) => control.id);
    setExpandedIds(new Set(parentIds));
  }, [controls]);

  const toggleExpand = (controlId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(controlId)) {
        next.delete(controlId);
      } else {
        next.add(controlId);
      }
      return next;
    });
  };

  if (filteredTree.length === 0) {
    return <div className={styles.emptyControls}>No controls on this screen</div>;
  }

  return (
    <ul className={styles.controlTree} data-testid="explorer-control-tree">
      {filteredTree.map((node) => (
        <ControlTreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          basePadding={basePadding}
          selectedControlId={selectedControlId}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          onSelectControl={onSelectControl}
        />
      ))}
    </ul>
  );
}
