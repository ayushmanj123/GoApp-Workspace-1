import styles from "./SegmentedControl.module.css";

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className={styles.group} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={[styles.option, value === opt.value ? styles.selected : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
