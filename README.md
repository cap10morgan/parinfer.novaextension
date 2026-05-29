# Parinfer for Nova

[Parinfer](https://shaunlebron.github.io/parinfer/) for [Panic Nova](https://nova.app):
keep parentheses and indentation in agreement as you edit Lisp code, so you can
manage structure by indentation (or by parens) without fighting the brackets.

Works with Clojure/ClojureScript (and other Lisps if their syntaxes are
installed): `.clj`, `.cljs`, `.cljc`, `.edn`, `.bb`, `.scm`, `.lisp`, `.fnl`, …

## Modes

- **Indent Mode** (default) — infers close-parens from your indentation (it may
  add or remove parens). The classic "never touch parens" experience.
- **Paren Mode** — preserves the parens you type and adjusts indentation to
  match. Safe and predictable; great for existing files.

> Smart Mode is intentionally not included: it needs precise change deltas that
> Nova's editor API doesn't expose, which makes it unreliable.

## Usage

Parinfer is **off by default**. Enable it via:

- **Editor → Parinfer: Toggle**, or **Use Paren Mode** / **Use Indent Mode**
  (also in the Command Palette), or
- **Settings** → enable Parinfer and pick a mode (global or per-workspace).

A brief notification confirms the active mode when you toggle or switch. (Nova
has no extension API for a status-bar indicator yet, so the notification stands
in for one.)

## Notes / limitations

- It needs a Lisp **syntax** to be active for the file (e.g. the Clojure
  extension provides the `clojure` syntax).
- Parinfer runs on the whole buffer per change; very large files are skipped.
- Programmatic edits may not coalesce into Nova's native undo as cleanly as
  ordinary typing.

## License

MIT. Bundles [parinfer.js](https://github.com/parinfer/parinfer.js)
(MIT, © Shaun Lebron).

The extension icon is the official [Parinfer logo](https://github.com/parinfer/parinfer-logo),
licensed [CC BY-NC-SA](https://creativecommons.org/licenses/by-nc-sa/4.0/).
