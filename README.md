# Handsfree

A Codex-like desktop app: a chat UI plus **hands-free computer use** (the agent
sees the screen and drives the mouse/keyboard). Native desktop app via
`deno desktop` (CEF window).

- **Brain:** OpenAI Codex via
  [`@mariozechner/pi-ai`](https://www.npmjs.com/package/@mariozechner/pi-ai)
  OAuth, using your `~/.codex/auth.json`.
- **Loop:**
  [`@mariozechner/pi-agent-core`](https://www.npmjs.com/package/@mariozechner/pi-agent-core).
- **Computer use:** **Deno FFI** — CoreGraphics (macOS) / user32 + gdi32
  (Windows). No native helper binary.
- **UI:** server-side JSX (nano-jsx) styled with twind (`tw`), **no client
  JavaScript, no bundler, no transpile step**.

## Layout

```
src/
  main.ts          the app: BrowserWindow, server-driven input/output, wiring
  codex.ts         codex OAuth token refresh
  agent.ts         pi-agent-core agent + zod-validated computer-use tools
  computer/
    mod.ts         ComputerUse interface + runtime platform loader
    macos.ts       CoreGraphics + screencapture
    win32.ts       user32 SendInput + gdi32 BitBlt
  chat.ts          server-side chat state + agent-event reducer
  view.tsx         nano-jsx + twind server rendering (page shell + message log)
```

Both computer-use backends implement one `ComputerUse` interface;
`computer/mod.ts` imports the matching one at runtime per `Deno.build.os` — the
other never loads.

## Run

```sh
deno task dev                # deno desktop --hmr — live reload

# build a native desktop app (deno desktop PR #33441 build):
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
