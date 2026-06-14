// Unit test for the chat guardrails: the deterministic banned-term output filter
// (safeAnswer) and the FAQ lookup. Needs NO API key — it verifies the two
// guardrails that don't depend on the model behaving.
//
// Run with:  node test-chat.mjs   (after `npm install` in this folder)
import { safeAnswer, stripMarkdown, faqLookup, FALLBACK } from "./chat.js";

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok:", m)) : (fail++, console.log("  FAIL:", m)));

// safeAnswer blocks the banned strings (post-model backstop).
ok(safeAnswer("Our codename is Project Titan internally.") === FALLBACK, "blocks banned codename 'Project Titan'");
ok(safeAnswer("This is internal-only data.") === FALLBACK, "blocks 'internal-only'");
ok(safeAnswer("Call us at +1 (415) 555 0199 today.") === FALLBACK, "blocks an international phone number");

// safeAnswer passes clean answers through (no false positives).
const c1 = "Acme Cloud starts at $0 on the Free plan.";
ok(safeAnswer(c1) === c1, "passes a clean answer through");
const c2 = "We shipped 40+ integrations between 2020 - 2024.";
ok(safeAnswer(c2) === c2, "date ranges / '40+' do NOT trip the phone filter");
// safeAnswer returns "" for empty; the handler turns that into FALLBACK via
// `safeAnswer(raw) || FALLBACK`. Test that real contract.
ok((safeAnswer("") || FALLBACK) === FALLBACK, "empty model output -> fallback (handler applies || FALLBACK)");

// stripMarkdown / safeAnswer flatten the Markdown the model sometimes emits,
// since the chat renders plain text (textContent) and brackets would show raw.
ok(
  stripMarkdown("See the [docs](https://example.com/docs).") ===
    "See the docs (https://example.com/docs).",
  "stripMarkdown: [label](url) -> label (url)"
);
ok(stripMarkdown("Acme Cloud is **fast**.") === "Acme Cloud is fast.", "stripMarkdown: **bold** -> bold");
ok(!/[[\]]/.test(safeAnswer("Read the [guide](https://example.com/guide) first.")), "safeAnswer leaves no markdown brackets in output");
ok(stripMarkdown(c1) === c1, "stripMarkdown is a no-op on plain prose");

// faqLookup hits the predictable questions.
ok(/free trial/i.test(faqLookup("Do you offer a free trial?") || ""), "FAQ: free trial");
ok(/support page/i.test(faqLookup("How do I get support?") || ""), "FAQ: support");
ok(/AI assistant/i.test(faqLookup("Are you a real person or a bot?") || ""), "FAQ: real person");

// Genuine questions fall through to the model (null).
ok(faqLookup("What databases does Acme Cloud use under the hood?") === null, "non-FAQ question falls through to model");
ok(faqLookup("How much storage is on the Pro plan?") === null, "specific pricing question falls through to model");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
