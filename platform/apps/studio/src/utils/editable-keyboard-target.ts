/** True when the event target is (or is inside) an editable field — skip canvas hotkeys. */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], .monaco-editor, [role='textbox']",
    ),
  );
}
