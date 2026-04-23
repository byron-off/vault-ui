import {
  CompletionContext,
  CompletionResult,
  Completion,
} from "@codemirror/autocomplete";

// ---------------------------------------------------------------------------
// Snippet helpers
// ---------------------------------------------------------------------------

function snip(label: string, template: string, info?: string): Completion {
  return {
    label,
    type: "keyword",
    info,
    apply: template,
    boost: 10,
  };
}

function value(label: string, info?: string): Completion {
  return { label: `"${label}"`, type: "constant", info, boost: 5 };
}

// ---------------------------------------------------------------------------
// Completion sets
// ---------------------------------------------------------------------------

const TOP_LEVEL_COMPLETIONS: Completion[] = [
  snip(
    "path",
    'path "secret/data/*" {\n  capabilities = ["read"]\n}',
    "Define a policy path block"
  ),
];

const PATH_BLOCK_COMPLETIONS: Completion[] = [
  snip(
    "capabilities",
    'capabilities = ["read"]',
    "List of allowed capabilities"
  ),
  snip(
    "allowed_parameters",
    'allowed_parameters = {\n  "" = []\n}',
    "Restrict which parameters are allowed"
  ),
  snip(
    "denied_parameters",
    'denied_parameters = {\n  "" = []\n}',
    "Explicitly deny certain parameters"
  ),
  snip(
    "required_parameters",
    'required_parameters = [""]',
    "Parameters that must be present"
  ),
  snip("min_wrapping_ttl", "min_wrapping_ttl = 1000", "Minimum wrapping TTL"),
  snip("max_wrapping_ttl", "max_wrapping_ttl = 9000", "Maximum wrapping TTL"),
];

const CAPABILITY_VALUE_COMPLETIONS: Completion[] = [
  "create",
  "read",
  "update",
  "delete",
  "list",
  "sudo",
  "deny",
  "patch",
].map((cap) => value(cap, `"${cap}" capability`));

// ---------------------------------------------------------------------------
// Context detection helpers
// ---------------------------------------------------------------------------

/**
 * Count the nesting depth of braces before `pos` in `doc`.
 * Returns the number of unclosed `{` characters.
 */
function braceDepthAt(doc: string, pos: number): number {
  let depth = 0;
  for (let i = 0; i < pos; i++) {
    if (doc[i] === "{") depth++;
    else if (doc[i] === "}") depth--;
  }
  return Math.max(0, depth);
}

/**
 * Returns true if the cursor is currently inside a `capabilities = [...]`
 * array (i.e., between `[` and `]` that follows a `capabilities` keyword).
 */
function insideCapabilitiesArray(doc: string, pos: number): boolean {
  const textBefore = doc.slice(0, pos);
  // Find the last opening bracket that hasn't been closed
  const lastBracket = textBefore.lastIndexOf("[");
  if (lastBracket === -1) return false;
  const afterBracket = textBefore.slice(lastBracket);
  if (afterBracket.includes("]")) return false; // already closed
  // Check if the bracket belongs to a capabilities/allowed/denied/required line
  const lineStart = textBefore.lastIndexOf("\n", lastBracket) + 1;
  const lineToBracket = textBefore.slice(lineStart, lastBracket).trimStart();
  return /^(capabilities)\s*=\s*$/.test(lineToBracket);
}

// ---------------------------------------------------------------------------
// Main completion source
// ---------------------------------------------------------------------------

export function hclCompletionSource(
  context: CompletionContext
): CompletionResult | null {
  const { state, pos, explicit } = context;
  const doc = state.doc.toString();

  // The word being typed (may be empty)
  const word = context.matchBefore(/[\w"]*/) ?? { from: pos, to: pos, text: "" };

  // Require either explicit trigger or at least one char typed
  if (!explicit && word.text.length === 0) return null;

  const depth = braceDepthAt(doc, word.from);

  // Inside a capabilities array → offer capability values
  if (insideCapabilitiesArray(doc, word.from)) {
    const from = word.text.startsWith('"') ? word.from : word.from;
    return {
      from,
      options: CAPABILITY_VALUE_COMPLETIONS,
      validFor: /^"?[\w]*"?$/,
    };
  }

  // Inside a path block (depth === 1) → offer block-level keys
  if (depth === 1) {
    return {
      from: word.from,
      options: PATH_BLOCK_COMPLETIONS,
      validFor: /^\w*$/,
    };
  }

  // Top level (depth === 0) → offer `path`
  return {
    from: word.from,
    options: TOP_LEVEL_COMPLETIONS,
    validFor: /^\w*$/,
  };
}
