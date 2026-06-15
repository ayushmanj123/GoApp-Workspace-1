import React from "react";
import { useRuntime } from "./runtime-hooks";
import ScreenRenderer from "./screen-renderer";

export const RuntimeRenderer: React.FC = () => {
  const ctx = useRuntime();
  if (ctx.loading) return <div>Loading...</div>;
  if (!ctx.pkg) return <div>No package</div>;
  const current = ctx.pkg.screens.find((s) => s.id === ctx.currentScreen);
  return <ScreenRenderer screen={current} />;
};

export default RuntimeRenderer;
