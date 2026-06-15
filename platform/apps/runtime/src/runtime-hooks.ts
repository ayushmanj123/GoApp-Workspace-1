import { useContext } from "react";
import { RuntimeContext } from "./runtime-provider";

export function useRuntime() {
  return useContext(RuntimeContext);
}
export function useCurrentScreen() {
  const ctx = useContext(RuntimeContext);
  return { currentScreen: ctx.currentScreen, setCurrentScreen: ctx.navigate };
}
export function useNavigate() {
  return useContext(RuntimeContext).navigate;
}
