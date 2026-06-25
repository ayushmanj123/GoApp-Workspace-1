import { useInteractionStore } from "./interactionStore";
import { useStudioStore } from "../../store/studioStore";

/** Keep studioStore.selectedControlId in sync with interaction primary selection. */
export function syncStudioSelection(): void {
  const primary = useInteractionStore.getState().primaryControlId;
  useStudioStore.setState({ selectedControlId: primary });
}
