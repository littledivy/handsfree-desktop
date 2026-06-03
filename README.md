# Codex Desktop

A Codex-like desktop app: a chat UI plus **hands-free computer use** (the agent
sees the screen and drives the mouse/keyboard). Runs as a native desktop app via
`deno desktop` (CEF window), or as a plain `deno run` server you open in a browser.

- **Brain:** OpenAI Codex via [`@mariozechner/pi-ai`](https://www.npmjs.com/package/@mariozechner/pi-ai) OAuth, using your `~/.codex/auth.json`.
- **Loop:** [`@mariozechner/pi-agent-core`](https://www.npmjs.com/package/@mariozechner/pi-agent-core).
- **Computer use:** native helper — `macctl` (macOS, CGEvent) / `winctl.exe` (Windows, SendInput + GDI).
- **App:** single self-contained `main.ts` (UI inlined), cross-platform.

## Layout
- `main.ts` — the whole app (agent loop, tools, server + SSE, inlined chat UI).
- `macctl.swift` — macOS input/capture helper source.
- `winctl.cs` — Windows input/capture helper source.
- `deno.json` — deps + tasks.

## Build the native helper
```sh
# macOS
swiftc -O macctl.swift -o macctl
# Windows (.NET Framework csc)
csc.exe /target:exe /out:winctl.exe /r:System.Drawing.dll /r:System.Windows.Forms.dll winctl.cs
```

## Run
```sh
# dev: plain server + browser (fast iteration)
deno run -A main.ts            # open the printed http://127.0.0.1:<port>

# native desktop app (deno desktop PR #33441 build):
deno desktop -A --include winctl.exe -o CodexDesktop main.ts   # Windows
deno desktop -A --include macctl    -o CodexDesktop.app main.ts # macOS
```

Needs a logged-in `~/.codex/auth.json` (run `codex login` if the brain says auth deferred).
`CODEX_MODEL` env overrides the model (default `gpt-5.4`).

## Notes
- Computer use needs Accessibility + Screen Recording permission (macOS) / an
  interactive desktop session (Windows). The agent screenshots first, then acts;
  coordinates are in screenshot-pixel space.
- `winctl openurl <url>` opens a URL reliably in one process (Win+R → type → Enter).
