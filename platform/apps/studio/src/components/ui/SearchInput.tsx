import { forwardRef, type InputHTMLAttributes } from "react";
import { IconSearch } from "./icons";
import styles from "./SearchInput.module.css";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
  fullWidth?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ shortcut, fullWidth = false, className, ...props }, ref) {
    return (
      <div
        className={[styles.wrapper, fullWidth ? styles.fullWidth : "", className]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.icon}>
          <IconSearch size={14} />
        </span>
        <input ref={ref} className={styles.input} type="search" {...props} />
        {shortcut ? <kbd className={styles.kbd}>{shortcut}</kbd> : null}
      </div>
    );
  },
);
