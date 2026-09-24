import {
  evaluateRuntimeFormula,
  postControlEvent,
  type RuntimeFormulaSession,
} from "../runtime-session-client";
import { hydrateSessionContext } from "./hydrate-session-context";
import { executeAction, type ActionServices } from "./execute-action";
import {
  isClientHostStatement,
  prepareHostArguments,
  splitFormulaStatements,
} from "./prepare-host-arguments";

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
  if (!formula) return;
  const prepared = await prepareHostArguments(formula, services.context);
  if (!session?.sessionId) {
    await executeAction({ formula: prepared }, services);
    return;
  }

  const remote = splitFormulaStatements(prepared).filter(
    (statement) => !isClientHostStatement(statement),
  );
  for (const statement of splitFormulaStatements(prepared)) {
    if (isClientHostStatement(statement)) {
      await executeAction({ formula: statement }, services);
    }
  }
  if (remote.length === 0) return;

  const response = await evaluateRuntimeFormula({
    appId: session.appId,
    sessionId: session.sessionId,
    screen: session.screen,
    formula: remote.join("; "),
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
