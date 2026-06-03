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

## Transport (no polling)
- **Desktop:** the UI talks to the Deno runtime over **`Deno.BrowserWindow` bindings** —
  `bindings.sendMessage()` in, `executeJs(window.__ev(...))` out. No SSE, no fetch.
  (A one-route `Deno.serve` still hands the CEF webview its HTML, because the desktop
  runtime navigates the window to the serve address — but all RPC rides the bindings.)
- **Browser dev:** falls back to SSE (`/events`) + `fetch('/chat')`.

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
