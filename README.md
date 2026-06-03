# Codex Desktop

A Codex-like desktop app: a chat UI plus **hands-free computer use** (the agent
sees the screen and drives the mouse/keyboard). Native desktop app via
`deno desktop` (CEF window), or a plain `deno run` server you open in a browser.

- **Brain:** OpenAI Codex via [`@mariozechner/pi-ai`](https://www.npmjs.com/package/@mariozechner/pi-ai) OAuth, using your `~/.codex/auth.json`.
- **Loop:** [`@mariozechner/pi-agent-core`](https://www.npmjs.com/package/@mariozechner/pi-agent-core).
- **Computer use:** **Deno FFI** — CoreGraphics (macOS) / user32 + gdi32 (Windows). No native helper binary.
- **UI:** server-side JSX — no client framework, no bundler.

## Layout
Three source files, nothing else:
- `main.tsx` — agent loop, tools (zod-validated), codex auth, transport, and the
  chat UI **rendered server-side** to an HTML string (a tiny JSX→string renderer;
  the page ships with plain-DOM client glue, no framework).
- `macos.ts` — macOS computer-use backend (CoreGraphics + `screencapture`).
- `win32.ts` — Windows computer-use backend (user32 SendInput + gdi32 BitBlt).

Both backends implement one `ComputerUse` interface; `main.tsx` imports the
matching one at runtime per `Deno.build.os` — no bundling, the other never loads.

## Transport — no web server (desktop)
- **Desktop:** the page is **built in Deno and loaded as a `data:` URL** (no `Deno.serve`).
  The UI talks to the runtime over **typed `Deno.BrowserWindow` bindings** —
  `bindings.sendMessage()` in, `executeJs(window.__ev(...))` out. No HTTP, no SSE, no fetch.
  (The desktop runtime force-navigates the window to its unused serve address ~15s in, so the
  app re-asserts its `data:` URL once past that — a brief one-time flicker, no server involved.)
- **Browser dev (`deno run`):** a small `Deno.serve` (page + SSE + `/chat`) so you can open it in a browser.

## Run
```sh
deno task start              # or: deno run -A main.tsx — open the printed http://127.0.0.1:<port>

# native desktop app (deno desktop PR #33441 build):
deno desktop -A -o CodexDesktop.app main.tsx   # macOS
deno desktop -A -o CodexDesktop     main.tsx   # Windows
```

Needs a logged-in `~/.codex/auth.json` (run `codex login` if the brain says auth deferred).
`CODEX_MODEL` env overrides the model (default `gpt-5.4`). FFI is covered by `-A`.

## Notes
- Computer use needs Accessibility + Screen Recording permission (macOS) / an
  interactive desktop session (Windows). The agent screenshots first, then acts;
  coordinates are in screenshot-pixel space.
