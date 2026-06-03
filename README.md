# Codex Desktop

A Codex-like desktop app: a Preact chat UI plus **hands-free computer use** (the
agent sees the screen and drives the mouse/keyboard). Native desktop app via
`deno desktop` (CEF window), or a plain `deno run` server you open in a browser.

- **Brain:** OpenAI Codex via [`@mariozechner/pi-ai`](https://www.npmjs.com/package/@mariozechner/pi-ai) OAuth, using your `~/.codex/auth.json`.
- **Loop:** [`@mariozechner/pi-agent-core`](https://www.npmjs.com/package/@mariozechner/pi-agent-core).
- **Computer use:** **Deno FFI** — CoreGraphics (macOS) / user32 + gdi32 (Windows). No native helper binary.
- **UI:** Preact + JSX (`ui.tsx`), **no bundler**.

## Layout
- `main.tsx` — agent loop, tools (zod-validated), codex auth, transport.
- `macos.ts` — macOS computer-use backend (CoreGraphics + `screencapture`).
- `win32.ts` — Windows computer-use backend (user32 SendInput + gdi32 BitBlt).
- `ui.tsx` — the Preact chat UI.

Both computer-use backends implement one `ComputerUse` interface; `main.tsx`
imports the matching one at runtime per `Deno.build.os` — the other never loads.

## No bundler
`ui.tsx` is **transpiled at runtime** (`jsr:@deno/emit`, TSX→JS, imports left
external) and inlined into the page as a `<script type="module">`. The browser
loads Preact straight from `esm.sh` — no bundle step, no `ui.js`.

## Transport — no web server (desktop)
- **Desktop:** the page is **built in Deno and loaded as a `data:` URL** (no `Deno.serve`).
  The UI talks to the runtime over typed `Deno.BrowserWindow` bindings —
  `bindings.sendMessage()` in, `executeJs(window.__ev(...))` out.
  (The desktop runtime force-navigates the window to its unused serve address ~15s in, so the
  app re-asserts its `data:` URL once past that; a ref'd timer keeps the runtime alive.)
- **Browser dev (`deno run`):** a small `Deno.serve` (page + SSE + `/chat`) so you can open it in a browser.

## Run
```sh
deno task start              # or: deno run -A main.tsx — open the printed http://127.0.0.1:<port>

# native desktop app (deno desktop PR #33441 build):
deno desktop -A --include ui.tsx -o CodexDesktop.app main.tsx   # macOS
deno desktop -A --include ui.tsx -o CodexDesktop     main.tsx   # Windows
```

Needs a logged-in `~/.codex/auth.json` (run `codex login` if the brain says auth deferred).
`CODEX_MODEL` env overrides the model (default `gpt-5.4`). FFI is covered by `-A`.

## Notes
- Computer use needs Accessibility + Screen Recording permission (macOS) / an
  interactive desktop session (Windows). The agent screenshots first, then acts;
  coordinates are in screenshot-pixel space.
