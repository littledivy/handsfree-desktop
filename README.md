# Handsfree

A Codex-like desktop app: a chat UI plus **hands-free computer use** (the agent
sees the screen and drives the mouse/keyboard). Native desktop app via
`deno desktop` (CEF window), or a plain `deno run` server you open in a browser.

- **Brain:** OpenAI Codex via
  [`@mariozechner/pi-ai`](https://www.npmjs.com/package/@mariozechner/pi-ai)
  OAuth, using your `~/.codex/auth.json`.
- **Loop:**
  [`@mariozechner/pi-agent-core`](https://www.npmjs.com/package/@mariozechner/pi-agent-core).
- **Computer use:** **Deno FFI** — CoreGraphics (macOS) / user32 + gdi32
  (Windows). No native helper binary.
- **UI:** server-side JSX (nano-jsx), **no client framework, no bundler, no
  transpile step**.

## Layout

```
src/
  main.ts          compose: auth → computer → agent → page → transport
  codex.ts         codex OAuth token refresh
  agent.ts         pi-agent-core agent + zod-validated computer-use tools
  computer/
    mod.ts         ComputerUse interface + runtime platform loader
    macos.ts       CoreGraphics + screencapture
    win32.ts       user32 SendInput + gdi32 BitBlt
  chat.ts          server-side chat state + agent-event reducer
  view.tsx         nano-jsx server rendering (page shell + message log)
  transport.ts     desktop (BrowserWindow) and browser (Deno.serve) transports
```

Both computer-use backends implement one `ComputerUse` interface;
`computer/mod.ts` imports the matching one at runtime per `Deno.build.os` — the
other never loads.

## All server-side rendered

The whole UI is JSX rendered to HTML **on the server** with `nano-jsx` — Deno
transpiles the JSX natively, so there is no client framework, no bundler, and no
transpile step. State lives in `chat.ts`; on every agent event the server
re-renders the message log and pushes the HTML to the page (`executeJs` on
desktop, SSE in the browser). The only client code is a tiny inline bridge:
relay the input box to `bindings.sendMessage` and swap `#log`'s `innerHTML`.

## Transport — no web server (desktop)

- **Desktop:** the page is loaded as a `data:` URL (no `Deno.serve`); updates
  ride `BrowserWindow.executeJs(window.__render(...))`. (The desktop runtime
  force-navigates the window to its unused serve address ~15s in, so the app
  re-asserts its `data:` URL once past that; a ref'd timer keeps the runtime
  alive.)
- **Browser dev (`deno run`):** a small `Deno.serve` (page + SSE + `/chat`).

## Run

```sh
deno task start              # or: deno run -A src/main.ts — open the printed http://127.0.0.1:<port>

# native desktop app (deno desktop PR #33441 build):
deno desktop -A -o Handsfree.app src/main.ts   # macOS
deno desktop -A -o Handsfree     src/main.ts   # Windows
```

Needs a logged-in `~/.codex/auth.json` (run `codex login` if the brain says auth
deferred). `CODEX_MODEL` env overrides the model (default `gpt-5.4`). FFI is
covered by `-A`.

## Notes

- Computer use needs Accessibility + Screen Recording permission (macOS) / an
  interactive desktop session (Windows). The agent screenshots first, then acts;
  coordinates are in screenshot-pixel space.
