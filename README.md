# Codex Desktop

A Codex-like desktop app: a Preact chat UI plus **hands-free computer use** (the
agent sees the screen and drives the mouse/keyboard). Native desktop app via
`deno desktop` (CEF window), or a plain `deno run` server you open in a browser.

- **Brain:** OpenAI Codex via [`@mariozechner/pi-ai`](https://www.npmjs.com/package/@mariozechner/pi-ai) OAuth, using your `~/.codex/auth.json`.
- **Loop:** [`@mariozechner/pi-agent-core`](https://www.npmjs.com/package/@mariozechner/pi-agent-core).
- **Computer use:** **Deno FFI** — CoreGraphics (macOS) / user32 + gdi32 (Windows). No native helper binary.
- **UI:** Preact + JSX (`ui.tsx`).

## Layout
- `main.ts` — agent loop, computer-use tools (FFI), transport, codex auth.
- `ui.tsx` — the Preact chat UI. Bundled to `ui.js` with `deno task ui`.
- `bundle-ui.ts` — bundles `ui.tsx` → `ui.js` (via `jsr:@deno/emit`).

## Transport — no web server (desktop)
- **Desktop:** the page is **built in Deno and loaded as a `data:` URL** (no `Deno.serve`).
  The UI talks to the runtime over **`Deno.BrowserWindow` bindings** — `bindings.sendMessage()`
  in, `executeJs(window.__ev(...))` out. No HTTP, no SSE, no fetch.
  (The desktop runtime force-navigates the window to its unused serve address ~15s in, so the
  app re-asserts its `data:` URL once past that — a brief one-time flicker, no server involved.)
- **Browser dev (`deno run`):** a small `Deno.serve` (page + SSE + `/chat`) so you can open it in a browser.

## Run
```sh
deno task ui                 # build ui.js from ui.tsx (commit-friendly)

deno run -A main.ts          # dev: open the printed http://127.0.0.1:<port>

# native desktop app (deno desktop PR #33441 build):
deno desktop -A --include ui.js -o CodexDesktop.app main.ts   # macOS
deno desktop -A --include ui.js -o CodexDesktop     main.ts   # Windows
```

Needs a logged-in `~/.codex/auth.json` (run `codex login` if the brain says auth deferred).
`CODEX_MODEL` env overrides the model (default `gpt-5.4`). FFI is covered by `-A`.

## Notes
- Computer use needs Accessibility + Screen Recording permission (macOS) / an
  interactive desktop session (Windows). The agent screenshots first, then acts;
  coordinates are in screenshot-pixel space.
