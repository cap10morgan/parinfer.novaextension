//
// main.js — Parinfer for Nova.
//
// Runs Parinfer (https://shaunlebron.github.io/parinfer/) over Lisp buffers on
// every change, keeping parens and indentation in agreement. Off by default;
// Paren or Indent mode, selectable via config or the Parinfer commands.
//

const parinfer = require("./parinfer.js");

// Syntaxes Parinfer applies to. clojure-lsp's extension registers "clojure"
// for clj/cljs/cljc/edn/bb; the others cover common Lisps if their syntaxes
// are installed.
const LISP_SYNTAXES = new Set([
    "clojure",
    "clojurescript",
    "scheme",
    "lisp",
    "commonlisp",
    "fennel",
    "edn",
]);

// Skip very large buffers — Parinfer is fast, but a full-buffer pass on every
// keystroke isn't worth it past this size.
const MAX_LENGTH = 1000000;

// --- config resolution (workspace overrides global) ---

function isEnabled() {
    const ws = nova.workspace.config.get("parinfer.enabled");
    if (ws === "true" || ws === true) return true;
    if (ws === "false" || ws === false) return false;
    return nova.config.get("parinfer.enabled", "boolean") === true;
}

function currentMode() {
    const ws = nova.workspace.config.get("parinfer.mode");
    if (ws === "paren" || ws === "indent") return ws;
    return nova.config.get("parinfer.mode", "string") === "indent"
        ? "indent"
        : "paren";
}

// --- position helpers (offset <-> {line, character}, 0-based) ---

function lineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text.charAt(i) === "\n") starts.push(i + 1);
    }
    return starts;
}

function offsetToPosition(starts, offset) {
    // Binary search for the line whose start is the greatest <= offset.
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= offset) lo = mid;
        else hi = mid - 1;
    }
    return { line: lo, character: offset - starts[lo] };
}

function positionToOffset(starts, line, character) {
    if (line >= starts.length) return starts[starts.length - 1];
    return starts[line] + character;
}

// Smallest single replacement that turns oldText into newText.
function diffRange(oldText, newText) {
    let start = 0;
    const min = Math.min(oldText.length, newText.length);
    while (start < min && oldText.charCodeAt(start) === newText.charCodeAt(start)) {
        start += 1;
    }
    let endOld = oldText.length;
    let endNew = newText.length;
    while (
        endOld > start &&
        endNew > start &&
        oldText.charCodeAt(endOld - 1) === newText.charCodeAt(endNew - 1)
    ) {
        endOld -= 1;
        endNew -= 1;
    }
    return { start, endOld, endNew };
}

// Wraps one TextEditor: listens for changes and applies Parinfer.
class ParinferEditor {
    constructor(editor) {
        this.editor = editor;
        this.applying = false;
        this.listener = editor.onDidChange(() => this.run());
    }

    dispose() {
        this.listener.dispose();
    }

    run() {
        // Ignore the change we cause by applying Parinfer's own edit.
        if (this.applying || !isEnabled()) return;

        const editor = this.editor;
        if (!LISP_SYNTAXES.has(editor.document.syntax)) return;
        const length = editor.document.length;
        if (length > MAX_LENGTH) return;

        const text = editor.getTextInRange(new Range(0, length));
        const starts = lineStarts(text);
        const cursor = offsetToPosition(starts, editor.selectedRange.end);

        const run = currentMode() === "indent"
            ? parinfer.indentMode
            : parinfer.parenMode;

        let result;
        try {
            result = run(text, { cursorLine: cursor.line, cursorX: cursor.character });
        } catch (error) {
            console.error(`[parinfer] ${error}`);
            return;
        }
        if (!result.success || result.text === text) return;

        const newText = result.text;
        const { start, endOld, endNew } = diffRange(text, newText);

        this.applying = true;
        editor
            .edit((edit) => {
                edit.replace(new Range(start, endOld), newText.slice(start, endNew));
            })
            .then(() => {
                const newStarts = lineStarts(newText);
                const offset =
                    result.cursorLine != null && result.cursorX != null
                        ? positionToOffset(newStarts, result.cursorLine, result.cursorX)
                        : editor.selectedRange.end;
                editor.selectedRange = new Range(offset, offset);
            })
            .catch((error) => {
                console.error(`[parinfer] failed to apply edit: ${error}`);
            })
            .then(() => {
                this.applying = false;
            });
    }
}

const editors = new Map();

function notifyState() {
    const request = new NotificationRequest("parinfer-state");
    request.title = "Parinfer";
    request.body = isEnabled()
        ? `Enabled — ${currentMode() === "indent" ? "Indent" : "Paren"} Mode`
        : "Disabled";
    nova.notifications.add(request);
}

// Re-run Parinfer on the active editor (e.g. right after enabling or switching
// mode) so the change takes effect immediately rather than on the next keypress.
function reapplyActive() {
    const editor = nova.workspace.activeTextEditor;
    if (editor && editors.has(editor)) {
        editors.get(editor).run();
    }
}

exports.activate = function () {
    nova.subscriptions.add(
        nova.workspace.onDidAddTextEditor((editor) => {
            if (editors.has(editor)) return;
            const pe = new ParinferEditor(editor);
            editors.set(editor, pe);
            editor.onDidDestroy(() => {
                pe.dispose();
                editors.delete(editor);
            });
        })
    );

    nova.commands.register("parinfer.toggle", () => {
        nova.config.set("parinfer.enabled", !isEnabled());
        notifyState();
        reapplyActive();
    });

    nova.commands.register("parinfer.useParenMode", () => {
        nova.config.set("parinfer.mode", "paren");
        if (!isEnabled()) nova.config.set("parinfer.enabled", true);
        notifyState();
        reapplyActive();
    });

    nova.commands.register("parinfer.useIndentMode", () => {
        nova.config.set("parinfer.mode", "indent");
        if (!isEnabled()) nova.config.set("parinfer.enabled", true);
        notifyState();
        reapplyActive();
    });
};

exports.deactivate = function () {
    for (const pe of editors.values()) pe.dispose();
    editors.clear();
};
