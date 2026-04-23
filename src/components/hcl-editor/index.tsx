"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorView, lineNumbers, keymap, placeholder } from "@codemirror/view";
import { EditorState, StateEffect, Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { hclLanguage, hclSyntaxHighlighting } from "./language";
import { hclCompletionSource } from "./completions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HCLEditorProps {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  /** Default: "400px" */
  height?: string;
  /** Default: true */
  showLineNumbers?: boolean;
  /** Default: true */
  showLint?: boolean;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const editorBaseTheme = EditorView.baseTheme({
  "&": {
    fontSize: "13px",
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    padding: "8px 0",
    caretColor: "#0550ae",
  },
  ".cm-line": {
    padding: "0 12px",
    lineHeight: "1.6",
  },
  ".cm-gutters": {
    backgroundColor: "#f6f8fa",
    borderRight: "1px solid #d0d7de",
    color: "#6e7781",
    minWidth: "40px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 4px",
    minWidth: "32px",
    textAlign: "right",
  },
  ".cm-activeLine": {
    backgroundColor: "#f6f8fa80",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#dce8f0",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "#0969da33 !important",
  },
  ".cm-cursor": {
    borderLeftColor: "#0550ae",
  },
  // Autocomplete dropdown
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid #d0d7de",
    borderRadius: "6px",
    boxShadow: "0 8px 24px rgba(140,149,159,0.2)",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "4px 12px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "#0969da",
    color: "#ffffff",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HCLEditor({
  value,
  onChange,
  readOnly = false,
  height = "400px",
  showLineNumbers = true,
  showLint: _showLint = true, // reserved for future lint integration
}: HCLEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Track the value that was last pushed to the editor so we don't loop.
  const internalValueRef = useRef<string>(value);

  // Debounced onChange to avoid cursor-position jumps caused by React
  // re-renders that reset the external value faster than typing.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleDocChange = useCallback((newValue: string) => {
    internalValueRef.current = newValue;
    onChangeRef.current?.(newValue);
  }, []);

  // Build the extension list
  const buildExtensions = useCallback((): Extension[] => {
    const exts: Extension[] = [
      // Language
      hclLanguage,
      hclSyntaxHighlighting,

      // Editing helpers
      history(),
      closeBrackets(),

      // Keymaps (indentWithTab is a KeyBinding, so it lives inside keymap.of)
      keymap.of([
        indentWithTab,
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap,
      ]),

      // Autocomplete
      autocompletion({
        override: [hclCompletionSource],
        activateOnTyping: true,
      }),

      // Base theme
      editorBaseTheme,

      // Placeholder hint
      placeholder('path "secret/data/*" {\n  capabilities = ["read"]\n}'),

      // Change listener
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          handleDocChange(update.state.doc.toString());
        }
      }),

      // Read-only
      EditorState.readOnly.of(readOnly),
    ];

    if (showLineNumbers) {
      exts.push(lineNumbers());
    }

    return exts;
  }, [readOnly, showLineNumbers, handleDocChange]);

  // Mount the editor once
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: buildExtensions(),
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    internalValueRef.current = value;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // We intentionally run this only on mount; prop changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconfigure when readOnly or showLineNumbers changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: StateEffect.reconfigure.of(buildExtensions()),
    });
  }, [buildExtensions, readOnly, showLineNumbers]);

  // Sync external value → editor (skip if the editor already has this value)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (internalValueRef.current === value) return;

    // Replace the entire document while preserving undo history position
    const currentDoc = view.state.doc.toString();
    if (currentDoc === value) {
      internalValueRef.current = value;
      return;
    }

    view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: value },
    });
    internalValueRef.current = value;
  }, [value]);

  return (
    <div
      style={{ minHeight: height }}
      className="relative rounded-md border border-[#d0d7de] overflow-hidden bg-white focus-within:ring-2 focus-within:ring-[#0969da] focus-within:ring-offset-0 focus-within:border-[#0969da] transition-shadow"
    >
      <div
        ref={containerRef}
        style={{ minHeight: height }}
        className="w-full [&_.cm-editor]:min-h-[inherit] [&_.cm-scroller]:min-h-[inherit]"
      />
    </div>
  );
}

export default HCLEditor;
