import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COMPONENT_CATALOG } from "../../data/component-catalog";
import { ComponentCard, PropertyCard, SegmentedControl, TabBar } from "../ui";
import styles from "./ComponentLibrary.module.css";

export function ComponentLibrary() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("GoApps Dashboard");
  const [gridColumns, setGridColumns] = useState("3");
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarSection, setSidebarSection] = useState("standard");
  const [propertyTab, setPropertyTab] = useState("layout");

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div>
          <div className={styles.sidebarTitle}>Project Explorer</div>
          <div className={styles.version}>v1.0.4</div>
        </div>
        <div>
          <div className={styles.sectionLabel}>Library</div>
          <button
            type="button"
            className={[styles.navItem, sidebarSection === "standard" ? styles.navItemActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setSidebarSection("standard")}
          >
            Standard Controls
          </button>
          <button type="button" className={styles.navItem} onClick={() => setSidebarSection("custom")}>
            Custom Components
          </button>
          <button type="button" className={styles.navItem} onClick={() => setSidebarSection("ai")}>
            AI-Generated
          </button>
        </div>
        <div>
          <div className={styles.sectionLabel}>Marketplace</div>
          <button type="button" className={styles.navItem}>All Plugins</button>
          <button type="button" className={styles.navItem}>Featured</button>
        </div>
        <div className={styles.proCard}>⚡ Pro Plan Active — Unlimited components</div>
      </aside>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Component Library</h1>
          <p className={styles.heroDesc}>
            Browse and add production-ready components to your canvas applications.
          </p>
        </div>

        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Popular Components</h2>
          <button type="button" className={styles.viewAll}>View All</button>
        </div>

        <div className={styles.grid}>
          {COMPONENT_CATALOG.map((item) => (
            <ComponentCard
              key={item.id}
              title={item.title}
              description={item.description}
              tag={item.tag}
              icon={<span style={{ fontSize: 18 }}>{item.icon}</span>}
              onAdd={() => navigate("/studio")}
            />
          ))}
        </div>

        <h2 className={styles.sectionTitle}>Marketplace Highlights</h2>
      </main>

      <aside className={styles.properties}>
        <div className={styles.propertiesHeader}>
          <div className={styles.propertiesTitle}>Properties</div>
          <div className={styles.propertiesSubtitle}>Selected: Project Home</div>
        </div>
        <TabBar
          tabs={[
            { id: "layout", label: "Layout" },
            { id: "style", label: "Style" },
            { id: "actions", label: "Actions" },
          ]}
          activeTab={propertyTab}
          onTabChange={setPropertyTab}
        />
        <div className={styles.propertiesBody}>
          {propertyTab === "layout" && (
            <>
              <PropertyCard title="Display">
                <label className={styles.fieldLabel}>Display Name</label>
                <input
                  className={styles.fieldInput}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </PropertyCard>
              <PropertyCard title="Grid">
                <label className={styles.fieldLabel}>Grid Columns</label>
                <SegmentedControl
                  options={[
                    { value: "2", label: "2" },
                    { value: "3", label: "3" },
                    { value: "4", label: "4" },
                  ]}
                  value={gridColumns}
                  onChange={setGridColumns}
                />
              </PropertyCard>
              <PropertyCard title="Theme">
                <label className={styles.fieldLabel}>
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={(e) => setDarkMode(e.target.checked)}
                  />{" "}
                  Dark Mode
                </label>
              </PropertyCard>
            </>
          )}
          <div className={styles.emptyState}>
            <span>◇</span>
            <span>Select a component to view and edit its properties.</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
