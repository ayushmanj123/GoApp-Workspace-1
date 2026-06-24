import type { Monaco } from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";
import { FORMULA_SUGGESTIONS } from "./formula-editor-suggestions";

const POWERFX_LANGUAGE = "powerfx";
let registered = false;

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

      return {
        suggestions: FORMULA_SUGGESTIONS.map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: label,
          range,
        })),
      };
    },
  });
}

export const FORMULA_EDITOR_LANGUAGE = POWERFX_LANGUAGE;
