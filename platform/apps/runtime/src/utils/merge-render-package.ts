import type { AppPackage, ControlPackage } from "../runtime-types";

export interface RenderControlPayload {
  id: string;
  type?: string;
  properties?: Record<string, unknown>;
}

export interface RenderScreenPayload {
  screen?: string;
  controls?: RenderControlPayload[];
}

function mergeControlTree(
  controls: ControlPackage[],
  byName: Map<string, Record<string, unknown>>,
): ControlPackage[] {
  return controls.map((control) => {
    const name = control.name?.trim() ?? "";
    const rendered = name ? byName.get(name) : undefined;
    const merged: ControlPackage = {
      ...control,
      properties: {
        ...((control.properties as Record<string, unknown> | undefined) ?? {}),
        ...(rendered ?? {}),
      },
    };
    if (control.children?.length) {
      merged.children = mergeControlTree(control.children, byName);
    }
    return merged;
  });
}

export function mergeRenderIntoPackage(
  pkg: AppPackage,
  screenId: string,
  render: RenderScreenPayload | undefined,
): AppPackage {
  if (!render?.controls?.length) {
    return pkg;
  }
  const byName = new Map<string, Record<string, unknown>>();
  for (const control of render.controls) {
    if (!control.id) continue;
    byName.set(control.id, control.properties ?? {});
  }
  return {
    ...pkg,
    screens: pkg.screens.map((screen) => {
      if (screen.id !== screenId) {
        return screen;
      }
      return {
        ...screen,
        controls: mergeControlTree(screen.controls ?? [], byName),
      };
    }),
  };
}
