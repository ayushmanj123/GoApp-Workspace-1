import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApplicationStore } from "../../store/applicationStore";
import type { ComponentTemplateId } from "../../utils/component-templates";

const TEMPLATES: { id: ComponentTemplateId; label: string; detail: string }[] = [
  { id: "blank", label: "Blank", detail: "An empty canvas and no properties yet." },
  { id: "list", label: "List", detail: "A gallery whose Items input binds to any entity or connector." },
  { id: "record-form", label: "Record form", detail: "A form bound to Source and Record inputs." },
];

export function ComponentLibrary() {
  const navigate = useNavigate();
  const applications = useApplicationStore((s) => s.applications);
  const loadApplications = useApplicationStore((s) => s.loadApplications);
  const componentDefinitions = useApplicationStore((s) => s.componentDefinitions);
  const loadComponentDefinitions = useApplicationStore((s) => s.loadComponentDefinitions);
  const createComponentFromTemplate = useApplicationStore((s) => s.createComponentFromTemplate);
  const [applicationId, setApplicationId] = useState("");
  const [name, setName] = useState("RecordList");

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (!applicationId && applications[0]) setApplicationId(applications[0].id);
  }, [applicationId, applications]);

  useEffect(() => {
    if (applicationId) void loadComponentDefinitions(applicationId);
  }, [applicationId, loadComponentDefinitions]);

  const create = (template: ComponentTemplateId) => {
    if (!applicationId || !name.trim()) return;
    void createComponentFromTemplate(applicationId, template, name.trim()).then((created) => {
      navigate(`/studio/apps/${applicationId}/components/${created.id}`);
    });
  };

  return (
    <main style={{ padding: 24, overflow: "auto" }}>
      <h1>Component Maker</h1>
      <p>
        Build a reusable component from the controls you already have. Bind its table and record
        properties to a platform table or to any connected database.
      </p>
      <label>
        Application
        <select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </select>
      </label>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        {TEMPLATES.map((template) => (
          <button key={template.id} type="button" onClick={() => create(template.id)}>
            <strong>{template.label}</strong>
            <div>{template.detail}</div>
          </button>
        ))}
      </div>
      <h2>This app</h2>
      <ul>
        {componentDefinitions.map((definition) => (
          <li key={definition.id}>
            <button
              type="button"
              onClick={() => navigate(`/studio/apps/${applicationId}/components/${definition.id}`)}
            >
              {definition.name}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
