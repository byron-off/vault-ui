import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Extension } from "@codemirror/state";

// HCL keywords (policy field names)
const HCL_KEYWORDS = new Set([
  "path",
  "capabilities",
  "allowed_parameters",
  "denied_parameters",
  "required_parameters",
  "min_wrapping_ttl",
  "max_wrapping_ttl",
]);

// Capability string values
const HCL_CAPABILITY_VALUES = new Set([
  "create",
  "read",
  "update",
  "delete",
  "list",
  "sudo",
  "deny",
  "patch",
]);

interface HCLState {
  inString: boolean;
  stringChar: string;
  inLineComment: boolean;
}

export const hclLanguage = StreamLanguage.define<HCLState>({
  name: "hcl",

  startState(): HCLState {
    return { inString: false, stringChar: "", inLineComment: false };
  },

  token(stream, state) {
    // Handle line comments (reset at start of each new line via blankLine / next call)
    if (state.inLineComment) {
      stream.skipToEnd();
      state.inLineComment = false;
      return "lineComment";
    }

    // Inside a string literal
    if (state.inString) {
      if (stream.eat("\\")) {
        stream.next(); // consume escaped char
        return "string";
      }
      if (stream.eat(state.stringChar)) {
        state.inString = false;
        return "string";
      }
      stream.next();
      return "string";
    }

    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Line comments: # or //
    if (stream.match("#") || stream.match("//")) {
      stream.skipToEnd();
      return "lineComment";
    }

    // Block comments: /* ... */
    if (stream.match("/*")) {
      while (!stream.eol()) {
        if (stream.match("*/")) break;
        stream.next();
      }
      return "blockComment";
    }

    // String literals
    const quote = stream.peek();
    if (quote === '"' || quote === "'") {
      stream.next();
      state.inString = true;
      state.stringChar = quote;
      // consume the content of the string on this line if possible
      while (!stream.eol()) {
        const ch = stream.peek();
        if (ch === "\\") {
          stream.next(); // backslash
          stream.next(); // escaped char
          continue;
        }
        if (ch === quote) {
          stream.next();
          state.inString = false;
          break;
        }
        stream.next();
      }
      return "string";
    }

    // Numbers
    if (stream.match(/^-?\d+(\.\d+)?([smhd])?/)) {
      return "number";
    }

    // Identifiers / keywords
    const wordMatch = stream.match(/^[a-zA-Z_][\w]*/);
    if (wordMatch) {
      const word = typeof wordMatch === "object" ? wordMatch[0] : stream.current();
      if (HCL_KEYWORDS.has(word)) return "keyword";
      if (HCL_CAPABILITY_VALUES.has(word)) return "atom";
      return "variableName";
    }

    // Punctuation / operators
    if (stream.match(/^[{}[\]=,]/)) {
      return "punctuation";
    }

    stream.next();
    return null;
  },

  blankLine(state) {
    state.inLineComment = false;
  },

  copyState(state): HCLState {
    return { ...state };
  },

  languageData: {
    commentTokens: { line: "#" },
    indentOnInput: /^\s*[}]$/,
  },
});

// A highlight style that maps our token types to colours that work on both
// light and dark backgrounds (they will be over-ridden by a theme if one is
// applied, but provide a sensible default).
export const hclHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#0550ae", fontWeight: "bold" },          // field names
  { tag: tags.atom, color: "#8250df" },                                  // capability values
  { tag: tags.string, color: "#0a3069" },                               // strings
  { tag: tags.number, color: "#0550ae" },                               // numbers
  { tag: tags.comment, color: "#6e7781", fontStyle: "italic" },         // comments
  { tag: tags.lineComment, color: "#6e7781", fontStyle: "italic" },
  { tag: tags.blockComment, color: "#6e7781", fontStyle: "italic" },
  { tag: tags.variableName, color: "#24292f" },
  { tag: tags.punctuation, color: "#24292f" },
]);

export const hclSyntaxHighlighting: Extension = syntaxHighlighting(hclHighlightStyle);
