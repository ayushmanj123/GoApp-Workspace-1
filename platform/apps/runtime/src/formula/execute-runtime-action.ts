import {
  evaluateRuntimeFormula,
  postControlEvent,
  type RuntimeFormulaSession,
} from "../runtime-session-client";
import { hydrateSessionContext } from "./hydrate-session-context";
import { executeAction, type ActionServices } from "./execute-action";

export interface RuntimeActionInput {
  formula: string;
  controlName?: string;
  event?: string;
}

export interface RuntimeActionServices extends ActionServices {
  session?: RuntimeFormulaSession;
  entityNames?: string[];
  navigateFromServer?: (screenName: string) => void;
  bumpGalleryRefresh?: () => void;
}

function shouldBumpGalleryRefresh(
  formula: string,
  refresh?: Array<{ controlId: string; reason: string }>,
): boolean {
  if (/Refresh\s*\(|Patch\s*\(|Collect\s*\(|ClearCollect\s*\(|Remove\s*\(|SubmitForm\s*\(/i.test(formula)) {
    return true;
  }
  if (!refresh?.length) return false;
  return refresh.some((item) => {
    const reason = (item.reason ?? "").toLowerCase();
    return (
      reason.includes("datasource") ||
      reason.includes("collection") ||
      reason.includes("gallery")
    );
  });
}

async function applySessionSideEffects(
  session: RuntimeFormulaSession,
  services: RuntimeActionServices,
  currentScreen?: string,
  refresh?: Array<{ controlId: string; reason: string }>,
  formula?: string,
): Promise<void> {
  if (services.store && services.collectionStore && services.entityNames) {
    await hydrateSessionContext({
      appId: session.appId,
      sessionId: session.sessionId,
      screen: currentScreen ?? session.screen,
      entityNames: services.entityNames,
      variableStore: services.store,
      collectionStore: services.collectionStore,
    });
  }
  if (currentScreen && services.navigateFromServer) {
    services.navigateFromServer(currentScreen);
  }
  if (formula && shouldBumpGalleryRefresh(formula, refresh)) {
    services.bumpGalleryRefresh?.();
  }
}

/**
 * Executes a behavior formula using the Go runtime session when available.
 * Uses the formula text from the client package so draft/preview controls work
 * even when the kernel metadata cache is stale.
 */
export async function executeRuntimeAction(
  input: RuntimeActionInput,
  services: RuntimeActionServices,
): Promise<void> {
  const session = services.session;
  const formula = input.formula?.trim();
  if (!session?.sessionId || !formula) {
    await executeAction({ formula: input.formula }, services);
    return;
  }

  const response = await evaluateRuntimeFormula({
    appId: session.appId,
    sessionId: session.sessionId,
    screen: session.screen,
    formula,
  });
  await applySessionSideEffects(
    session,
    services,
    response.currentScreen,
    response.refresh,
    formula,
  );
}

export async function syncServerScreenVisible(
  session: RuntimeFormulaSession,
  screenName: string,
): Promise<string | undefined> {
  const event = await postControlEvent({
    appId: session.appId,
    sessionId: session.sessionId,
    screen: screenName,
    event: "OnVisible",
  });
  return event.currentScreen;
}
