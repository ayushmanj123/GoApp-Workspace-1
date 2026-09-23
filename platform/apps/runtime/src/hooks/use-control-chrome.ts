import { useMemo, useState } from "react";
import { useResolvedPropertyText } from "./use-resolved-property-text";
import {
  appearanceCss,
  readOptionalNumber,
  resolveInteractionStyle,
} from "../utils/appearance-style";

export function useControlChrome(
  source: Record<string, unknown>,
  options?: { disabled?: boolean; includeText?: boolean },
) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  const fill = useResolvedPropertyText(source.fill ?? source.Fill, "");
  const color = useResolvedPropertyText(source.color ?? source.Color, "");
  const borderColor = useResolvedPropertyText(source.borderColor ?? source.BorderColor, "");
  const hoverFill = useResolvedPropertyText(source.hoverFill ?? source.HoverFill, "");
  const pressedFill = useResolvedPropertyText(source.pressedFill ?? source.PressedFill, "");
  const disabledFill = useResolvedPropertyText(source.disabledFill ?? source.DisabledFill, "");
  const hoverColor = useResolvedPropertyText(source.hoverColor ?? source.HoverColor, "");
  const pressedColor = useResolvedPropertyText(source.pressedColor ?? source.PressedColor, "");
  const focusedBorderColor = useResolvedPropertyText(
    source.focusedBorderColor ?? source.FocusedBorderColor,
    "",
  );

  const disabled = Boolean(options?.disabled);
  const includeText = options?.includeText !== false;

  const style = useMemo(() => {
    const colors = {
      fill,
      color,
      borderColor,
      hoverFill,
      pressedFill,
      disabledFill,
      hoverColor,
      pressedColor,
      focusedBorderColor,
    };
    const base = appearanceCss(colors, source, { includeText });
    return resolveInteractionStyle(base, colors, { hover, pressed, focused, disabled });
  }, [
    fill,
    color,
    borderColor,
    hoverFill,
    pressedFill,
    disabledFill,
    hoverColor,
    pressedColor,
    focusedBorderColor,
    source,
    includeText,
    hover,
    pressed,
    focused,
    disabled,
  ]);

  const tabIndex = readOptionalNumber(source.tabIndex ?? source.TabIndex);

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPressed(false);
    },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };

  return { style, tabIndex, handlers };
}

export function chainFocus(
  chrome: { handlers: { onFocus: () => void; onBlur: () => void } },
  onFocus?: () => void,
  onBlur?: () => void,
) {
  return {
    onFocus: () => {
      chrome.handlers.onFocus();
      onFocus?.();
    },
    onBlur: () => {
      chrome.handlers.onBlur();
      onBlur?.();
    },
  };
}
