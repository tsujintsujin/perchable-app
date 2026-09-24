// Lock: no app code before Justin approves PLAN.md and docs/DESIGN.md.
// Runs as a Claude Code PreToolUse hook. Exit 2 = block (stderr goes to Claude).
const fs = require("fs");
const path = require("path");

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const APPROVAL = "Approved by Justin";

function approved(rel) {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8")
      .split(/\r?\n/).some((l) => l.startsWith(APPROVAL + ":"));
  } catch { return false; }
}

function block(msg) {
  process.stderr.write("LOCKED: " + msg + "\n");
  process.exit(2);
}

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let e;
  try { e = JSON.parse(input); } catch { process.exit(0); }
  const tool = e.tool_name || "";
  const t = e.tool_input || {};

  // Rule 3 (always): nobody but Justin writes the approval line.
  const text = [t.content, t.new_string, t.command,
    ...(Array.isArray(t.edits) ? t.edits.map((x) => x.new_string) : [])]
    .filter(Boolean).join("\n");
  if (text.includes(APPROVAL)) {
    block(`only Justin may write "${APPROVAL}" — he adds it by hand.`);
  }

  // The lock itself can't be edited by agents.
  const file = t.file_path || t.notebook_path || "";
  const rel = file ? path.relative(root, path.resolve(root, file)).replace(/\\/g, "/") : "";
  if (rel.startsWith(".claude/hooks/") || rel === ".claude/settings.json") {
    block("the lock files are Justin's; agents can't change them.");
  }

  const unlocked = approved("PLAN.md") && approved("docs/DESIGN.md");
  if (unlocked) process.exit(0);

  const why = "app code is locked until PLAN.md and docs/DESIGN.md each have a line starting \"Approved by Justin:\".";

  // Rule 1: file writes only in the planning areas.
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool) && rel) {
    const ok = rel.startsWith("docs/") || rel.startsWith("logs/") ||
      rel.startsWith("design-src/") || rel.startsWith(".claude/") ||
      (!rel.includes("/") && rel.endsWith(".md"));
    if (!ok && !rel.startsWith("..")) block(`${rel}: ${why}`);
  }

  // Rule 2: no scaffolding or installing app code from the shell.
  if (tool === "Bash" && t.command) {
    const scaffold = /(create-expo-app|npx\s+create-|expo\s+init|npx\s+expo\s+install|\b(npm|pnpm|yarn|bun)\s+(i|install|add)\b)/i;
    if (scaffold.test(t.command)) block(`shell scaffold/install: ${why}`);
  }
  process.exit(0);
});
