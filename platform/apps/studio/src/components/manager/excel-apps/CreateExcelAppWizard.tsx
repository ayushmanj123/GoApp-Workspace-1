import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applicationsApi } from "../../../api/applications-api";
import {
  connectorsApi,
  type GoogleSpreadsheetFile,
} from "../../../api/connectors-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";
import { GoogleOAuthConnect } from "./GoogleOAuthConnect";
import { Button } from "../../ui";

interface SheetSelection {
  sheet_name: string;
  connector_name: string;
  key_column: string;
  selected: boolean;
  columns: string[];
}

interface CreateExcelAppWizardProps {
  open: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 3;
const BOOTSTRAP_DESC = "excel_app:bootstrap";
const BOOTSTRAP_CONNECTOR_NAME = "GoogleBootstrap";

function pickDefaultKeyColumn(columns: string[]): string {
  const preferred = columns.find((c) => /^id$/i.test(c));
  if (preferred) return preferred;
  return columns[0] ?? "Id";
}

async function pollOAuthConnected(connectorId: string, timeoutMs = 60000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await connectorsApi.getOAuthConnection(connectorId);
    if (status.connected) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export function CreateExcelAppWizard({ open, onClose }: CreateExcelAppWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [appName, setAppName] = useState("");
  const [template, setTemplate] = useState<"gallery_form" | "datatable_form">("gallery_form");
  const [bootstrapConnectorId, setBootstrapConnectorId] = useState("");
  const [oauthConnected, setOauthConnected] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [files, setFiles] = useState<GoogleSpreadsheetFile[]>([]);
  const [sheets, setSheets] = useState<SheetSelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [pollingOAuth, setPollingOAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrapIdRef = useRef("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setAppName("");
    setTemplate("gallery_form");
    setBootstrapConnectorId("");
    bootstrapIdRef.current = "";
    setOauthConnected(false);
    setSpreadsheetId("");
    setFiles([]);
    setSheets([]);
    setError(null);
    setBootstrapping(true);
    void ensureBootstrap()
      .then((id) => refreshOAuth(id))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to initialize OAuth"))
      .finally(() => setBootstrapping(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when wizard opens
  }, [open]);

  const refreshOAuth = async (connectorId: string) => {
    const status = await connectorsApi.getOAuthConnection(connectorId);
    setOauthConnected(Boolean(status.connected));
  };

  const ensureBootstrap = async (): Promise<string> => {
    if (bootstrapIdRef.current) return bootstrapIdRef.current;
    if (bootstrapConnectorId) {
      bootstrapIdRef.current = bootstrapConnectorId;
      return bootstrapConnectorId;
    }

    const page = await applicationsApi.list(200, 0);
    const existingApp = (page.items ?? []).find((a) => (a.description ?? "") === BOOTSTRAP_DESC);
    if (existingApp) {
      const connectors = await connectorsApi.list(existingApp.id, 50, 0);
      const existing =
        (connectors.items ?? []).find((c) => c.name === BOOTSTRAP_CONNECTOR_NAME) ??
        (connectors.items ?? []).find((c) => c.connector_type === "google_sheets");
      if (existing) {
        bootstrapIdRef.current = existing.id;
        setBootstrapConnectorId(existing.id);
        return existing.id;
      }
    }

    const bootstrapApp =
      existingApp ??
      (await applicationsApi.create({
        name: "Google Sheets Bootstrap",
        description: BOOTSTRAP_DESC,
      }));
    const connector = await connectorsApi.create(bootstrapApp.id, {
      name: BOOTSTRAP_CONNECTOR_NAME,
      connector_type: "google_sheets",
      authentication_type: "oauth_authorization_code",
      auth_config: {
        type: "oauth_authorization_code",
        connection_scope: "user",
        sheet_name: "Sheet1",
        header_row: 1,
      },
    });
    bootstrapIdRef.current = connector.id;
    setBootstrapConnectorId(connector.id);
    return connector.id;
  };

  const loadSheetsForSpreadsheet = async (connectorId: string, fileId: string) => {
    await connectorsApi.update(connectorId, {
      auth_config: {
        type: "oauth_authorization_code",
        connection_scope: "user",
        spreadsheet_id: fileId,
        sheet_name: "Sheet1",
        header_row: 1,
      },
    });
    const sheetTabs = await connectorsApi.listGoogleSheets(connectorId, fileId);
    const selections: SheetSelection[] = [];
    for (const t of sheetTabs) {
      let columns: string[] = [];
      try {
        const preview = await connectorsApi.previewGoogleSheet(connectorId, t.title, 1);
        columns = preview.columns ?? [];
      } catch {
        columns = [];
      }
      selections.push({
        sheet_name: t.title,
        connector_name: t.title.replace(/\s+/g, ""),
        key_column: pickDefaultKeyColumn(columns),
        selected: true,
        columns,
      });
    }
    setSheets(selections);
  };

  const handleOAuthStarted = async () => {
    const connectorId = bootstrapIdRef.current || bootstrapConnectorId;
    if (!connectorId) return;
    setPollingOAuth(true);
    setError(null);
    try {
      const ok = await pollOAuthConnected(connectorId);
      setOauthConnected(ok);
      if (!ok) {
        setError("Google connection timed out. Finish consent in the popup, then try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check Google connection");
    } finally {
      setPollingOAuth(false);
    }
  };

  const handleNext = async () => {
    setError(null);
    try {
      if (step === 0) {
        const connectorId = bootstrapIdRef.current || bootstrapConnectorId || (await ensureBootstrap());
        if (!oauthConnected) {
          setError("Connect your Google account before continuing.");
          return;
        }
        const list = await connectorsApi.listGoogleFiles(connectorId);
        setFiles(list);
        setStep(1);
        return;
      }
      if (step === 1) {
        if (!spreadsheetId) {
          setError("Select a spreadsheet.");
          return;
        }
        const connectorId = bootstrapIdRef.current || bootstrapConnectorId || (await ensureBootstrap());
        await loadSheetsForSpreadsheet(connectorId, spreadsheetId);
        setStep(2);
        return;
      }
      if (step === 2) {
        if (!appName.trim()) {
          setError("Enter an app name.");
          return;
        }
        const selected = sheets.filter((s) => s.selected);
        if (selected.length === 0) {
          setError("Select at least one sheet.");
          return;
        }
        const primary = selected[0];
        if (!primary.columns.length) {
          setError(
            `Sheet "${primary.sheet_name}" has no header columns. Add a header row and try again.`,
          );
          return;
        }
        if (!primary.key_column.trim()) {
          setError("Select a key column for the primary sheet.");
          return;
        }
        setSaving(true);
        const result = await applicationsApi.scaffoldExcelApp({
          app_name: appName.trim(),
          spreadsheet_id: spreadsheetId,
          template,
          bootstrap_connector_id: bootstrapIdRef.current || bootstrapConnectorId,
          sheets: selected.map((s) => ({
            sheet_name: s.sheet_name,
            connector_name: s.connector_name,
            key_column: s.key_column,
            header_row: 1,
          })),
        });
        onClose();
        navigate(`/studio/apps/${result.application_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${modalStyles.dialog}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create Excel App"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>
            Create Excel App — Step {step + 1} of {TOTAL_STEPS}
          </div>
        </header>
        <div className={modalStyles.body}>
          {step === 0 ? (
            <>
              <p style={{ fontSize: 12, color: "#666" }}>
                Connect Google Drive to use spreadsheets as live data sources.
              </p>
              {bootstrapping || !bootstrapConnectorId ? (
                <p style={{ fontSize: 12 }}>Initializing Google OAuth…</p>
              ) : (
                <GoogleOAuthConnect
                  connectorId={bootstrapConnectorId}
                  connected={oauthConnected}
                  onConnected={() => {
                    void handleOAuthStarted();
                  }}
                />
              )}
              {pollingOAuth ? (
                <p style={{ fontSize: 12, marginTop: 8 }}>Waiting for Google consent…</p>
              ) : null}
            </>
          ) : null}
          {step === 1 ? (
            <>
              <p style={{ fontSize: 12, color: "#666" }}>Select a spreadsheet from Google Drive.</p>
              <select
                style={{ width: "100%", padding: "8px", marginTop: 8 }}
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
              >
                <option value="">Select spreadsheet…</option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
                App name
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Order Tracker"
                />
              </label>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
                Template
                <select
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={template}
                  onChange={(e) =>
                    setTemplate(e.target.value === "datatable_form" ? "datatable_form" : "gallery_form")
                  }
                >
                  <option value="gallery_form">Gallery + Form</option>
                  <option value="datatable_form">DataTable + Form</option>
                </select>
              </label>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Sheets to include</p>
              {sheets.filter((s) => s.selected).length > 1 ? (
                <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                  List and Edit screens are generated for the{" "}
                  <strong>first selected sheet</strong> (
                  {sheets.find((s) => s.selected)?.sheet_name ?? "primary"}). Additional sheets are
                  created as datasources you can bind in Studio.
                </p>
              ) : null}
              {sheets.map((s, i) => (
                <div key={s.sheet_name} style={{ marginBottom: 12, fontSize: 12 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={s.selected}
                      onChange={(e) => {
                        const next = [...sheets];
                        next[i] = { ...s, selected: e.target.checked };
                        setSheets(next);
                      }}
                    />
                    {s.sheet_name}
                    {!s.columns.length ? (
                      <span style={{ color: "var(--color-danger)" }}>(no headers)</span>
                    ) : null}
                  </label>
                  <label style={{ display: "block", marginTop: 4 }}>
                    Key column
                    {s.columns.length > 0 ? (
                      <select
                        style={{ display: "block", width: "100%", marginTop: 4, padding: "4px 6px" }}
                        value={s.key_column}
                        onChange={(e) => {
                          const next = [...sheets];
                          next[i] = { ...s, key_column: e.target.value };
                          setSheets(next);
                        }}
                      >
                        {s.columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        style={{ display: "block", width: "100%", marginTop: 4, padding: "4px 6px" }}
                        value={s.key_column}
                        placeholder="Key column (e.g. Id)"
                        onChange={(e) => {
                          const next = [...sheets];
                          next[i] = { ...s, key_column: e.target.value };
                          setSheets(next);
                        }}
                      />
                    )}
                  </label>
                </div>
              ))}
            </>
          ) : null}
          {error ? <p style={{ color: "var(--color-danger)", fontSize: 12 }}>{error}</p> : null}
          <div className={modalStyles.footer}>
            <button type="button" className={modalStyles.cancelBtn} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            {step > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => setStep(step - 1)} disabled={saving}>
                Back
              </Button>
            ) : null}
            <button
              type="button"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || bootstrapping || pollingOAuth}
              onClick={() => void handleNext()}
            >
              {saving ? "Creating…" : step === 2 ? "Create Excel App" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
