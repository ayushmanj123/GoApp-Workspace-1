import type { Monaco } from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";
import { getPropertyDefinitions } from "../../property-metadata/registry";
import { FORMULA_SUGGESTIONS } from "./formula-editor-suggestions";
import { getFormulaHintSnapshot } from "./formula-hint-source";

const POWERFX_LANGUAGE = "powerfx";
const LAYOUT_PROPERTIES = ["X", "Y", "Width", "Height"];
let registered = false;

function propertyHints(controlType: string): string[] {
  const fromRegistry = getPropertyDefinitions(controlType).map((field) => field.label);
  return [...new Set([...fromRegistry, ...LAYOUT_PROPERTIES])];
}

export function setupMonacoFormulaEditor(monaco: Monaco): void {
  if (registered) {
    return;
  }
  registered = true;

  monaco.languages.register({ id: POWERFX_LANGUAGE });
  monaco.languages.setMonarchTokensProvider(POWERFX_LANGUAGE, {
    keywords: [...FORMULA_SUGGESTIONS],
    tokenizer: {
      root: [
        [/"([^"\\]|\\.)*"/, "string"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [
          /[A-Za-z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@default": "identifier",
            },
          },
        ],
        [/[{}()[\].,;:]/, "delimiter"],
        [/\s+/, "white"],
      ],
    },
  });

  monaco.languages.registerCompletionItemProvider(POWERFX_LANGUAGE, {
    triggerCharacters: ["(", ".", ","],
    provideCompletionItems: (
      model: MonacoEditor.editor.ITextModel,
      position: MonacoEditor.Position,
    ) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const member = before.match(/([A-Za-z_]\w*)\.$/);
      const hints = getFormulaHintSnapshot();

      if (member) {
        const control = hints.controls.find((item) => item.name === member[1]);
        const labels = control ? propertyHints(control.type) : LAYOUT_PROPERTIES;
        return {
          suggestions: labels.map((label) => ({
            label,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: label,
            range,
          })),
        };
      }

      const names = [
        ...FORMULA_SUGGESTIONS.map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Function,
        })),
        ...hints.controls
          .filter((item) => item.name.trim())
          .map((item) => ({
            label: item.name,
            kind: monaco.languages.CompletionItemKind.Variable,
          })),
        ...hints.variables.map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Variable,
        })),
      ];

      return {
        suggestions: names.map((item) => ({
          label: item.label,
          kind: item.kind,
          insertText: item.label,
          range,
        })),
      };
    },
  });
}

export const FORMULA_EDITOR_LANGUAGE = POWERFX_LANGUAGE;
