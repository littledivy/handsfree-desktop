// codex-demo — a Codex-like desktop app: chat UI + hands-free macOS computer use.
// Brain: OpenAI Codex (via pi-ai OAuth, using your ~/.codex creds).
// Loop: @mariozechner/pi-agent-core. UI: served HTML + SSE, shown in a
// Deno.BrowserWindow (CEF) when run via `deno desktop`, else a normal browser.
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { refreshOpenAICodexToken } from "@mariozechner/pi-ai/oauth";
import { Type } from "@sinclair/typebox";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const HOME = (Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE"))!;
const MODEL_ID = Deno.env.get("CODEX_MODEL") ?? "gpt-5.4";
const enc = new TextEncoder();

// ---------------------------------------------------------------------------
// Codex auth: refresh the access token from ~/.codex/auth.json, keep it fresh.
// ---------------------------------------------------------------------------
let codexToken = "";
let codexExpiry = 0;
function jwtExpMs(t: string): number {
  try {
    return (JSON.parse(atob(t.split(".")[1])).exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}
async function refreshCodex() {
  const path = `${HOME}/.codex/auth.json`;
  const cx = JSON.parse(await Deno.readTextFile(path));
  // Prefer the stored access token while it's still valid — codex refresh
  // tokens are single-use and may already be consumed elsewhere.
  const stored = cx.tokens?.access_token ?? "";
  const storedExp = jwtExpMs(stored);
  if (stored && storedExp > Date.now() + 60_000) {
    codexToken = stored;
    codexExpiry = storedExp;
    return;
  }
  // Stored token expired — rotate via the refresh token and persist.
  const rt = cx.tokens?.refresh_token;
  if (!rt) throw new Error("no usable codex token in ~/.codex/auth.json");
  const c = await refreshOpenAICodexToken(rt);
  codexToken = c.access ?? c.access_token ?? "";
  if (!codexToken) throw new Error("codex refresh returned empty access token");
  cx.tokens.access_token = codexToken;
  cx.tokens.refresh_token = c.refresh ?? c.refresh_token ?? rt;
  cx.last_refresh = new Date().toISOString();
  await Deno.writeTextFile(path, JSON.stringify(cx, null, 2)).catch(() => {});
  codexExpiry = jwtExpMs(codexToken) || Date.now() + 50 * 60_000;
}
async function codexApiKey() {
  if (!codexToken || Date.now() > codexExpiry - 60_000) await refreshCodex();
  return codexToken;
}

// ---------------------------------------------------------------------------
// macOS computer-use helpers (macctl = CGEvent helper, screencapture for vision)
// ---------------------------------------------------------------------------
// macctl is exec'd, so it needs a real filesystem path. In a compiled bundle
// the `--include`d copy lives in the embedded FS (not executable), so extract
// it to a temp file. Works the same in dev (reads the real binary).
const IS_WIN = Deno.build.os === "windows";
const HELPER = await (async () => {
  const override = Deno.env.get("CTL_BIN");
  if (override) return override;
  const name = IS_WIN ? "winctl.exe" : "macctl";
  const bytes = await Deno.readFile(new URL("./" + name, import.meta.url));
  const tmp = await Deno.makeTempFile({ prefix: "ctl-", suffix: IS_WIN ? ".exe" : "" });
  await Deno.writeFile(tmp, bytes);
  if (!IS_WIN) await Deno.chmod(tmp, 0o755);
  return tmp;
})();
async function ctl(...args: string[]) {
  const { success, stdout, stderr } = await new Deno.Command(HELPER, { args }).output();
  if (!success) throw new Error(`ctl ${args[0]} failed: ${new TextDecoder().decode(stderr)}`);
  return new TextDecoder().decode(stdout).trim();
}
const [SCREEN_W, SCREEN_H] = (await ctl("screensize")).split(/\s+/).map(Number);

// Capture the screen as a base64 PNG. Screenshot pixels == the coordinate
// space click/move use. macOS: screencapture + sips downscale to points.
// Windows: winctl captures the primary screen (DPI-aware physical pixels).
async function screenshot(): Promise<string> {
  const out = await Deno.makeTempFile({ suffix: ".png" });
  if (IS_WIN) {
    await ctl("screenshot", out);
  } else {
    const raw = await Deno.makeTempFile({ suffix: ".png" });
    await new Deno.Command("screencapture", { args: ["-x", "-t", "png", raw] }).output();
    await new Deno.Command("sips", {
      args: ["-z", String(SCREEN_H), String(SCREEN_W), raw, "--out", out],
    }).output();
    await Deno.remove(raw).catch(() => {});
  }
  const bytes = await Deno.readFile(out);
  await Deno.remove(out).catch(() => {});
  return encodeBase64(bytes);
}

function img(b64: string) {
  return { type: "image" as const, data: b64, mimeType: "image/png" };
}
function txt(s: string) {
  return { type: "text" as const, text: s };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
const tools = [
  {
    name: "screenshot",
    label: "screenshot",
    description:
      `Capture the current screen. Returns a ${SCREEN_W}x${SCREEN_H} image; ` +
      `all click/move coordinates are in this pixel space (top-left origin).`,
    parameters: Type.Object({}),
    execute: async () => ({
      content: [txt(`screen ${SCREEN_W}x${SCREEN_H}`), img(await screenshot())],
      details: {},
    }),
  },
  {
    name: "click",
    label: "click",
    description: "Left-click at (x, y). Set double=true for double-click, right=true for right-click.",
    parameters: Type.Object({
      x: Type.Number(),
      y: Type.Number(),
      double: Type.Optional(Type.Boolean()),
      right: Type.Optional(Type.Boolean()),
    }),
    execute: async (_id: string, p: { x: number; y: number; double?: boolean; right?: boolean }) => {
      await ctl(p.right ? "rightclick" : p.double ? "doubleclick" : "click", String(p.x), String(p.y));
      await new Promise((r) => setTimeout(r, 300));
      return { content: [txt(`clicked ${p.x},${p.y}`), img(await screenshot())], details: {} };
    },
  },
  {
    name: "move",
    label: "move",
    description: "Move the mouse to (x, y) without clicking.",
    parameters: Type.Object({ x: Type.Number(), y: Type.Number() }),
    execute: async (_id: string, p: { x: number; y: number }) => {
      await ctl("move", String(p.x), String(p.y));
      return { content: [txt(`moved ${p.x},${p.y}`)], details: {} };
    },
  },
  {
    name: "type",
    label: "type",
    description: "Type the given text at the current focus.",
    parameters: Type.Object({ text: Type.String() }),
    execute: async (_id: string, p: { text: string }) => {
      await ctl("type", p.text);
      await new Promise((r) => setTimeout(r, 200));
      return { content: [txt(`typed ${p.text.length} chars`), img(await screenshot())], details: {} };
    },
  },
  {
    name: "key",
    label: "key",
    description: 'Press a key or combo, e.g. "return", "cmd+space", "cmd+shift+4", "escape".',
    parameters: Type.Object({ keys: Type.String() }),
    execute: async (_id: string, p: { keys: string }) => {
      await ctl("key", p.keys);
      await new Promise((r) => setTimeout(r, 250));
      return { content: [txt(`pressed ${p.keys}`), img(await screenshot())], details: {} };
    },
  },
  {
    name: "scroll",
    label: "scroll",
    description: "Scroll by (dx, dy) pixels. Positive dy scrolls up, negative down.",
    parameters: Type.Object({ dx: Type.Number(), dy: Type.Number() }),
    execute: async (_id: string, p: { dx: number; dy: number }) => {
      await ctl("scroll", String(p.dx), String(p.dy));
      await new Promise((r) => setTimeout(r, 250));
      return { content: [txt(`scrolled ${p.dx},${p.dy}`), img(await screenshot())], details: {} };
    },
  },
  {
    name: "shell",
    label: "shell",
    description: "Run a shell command (PowerShell on Windows, bash on macOS) and return output.",
    parameters: Type.Object({ command: Type.String() }),
    execute: async (_id: string, p: { command: string }) => {
      const cmd = IS_WIN
        ? new Deno.Command("powershell", { args: ["-NoProfile", "-Command", p.command] })
        : new Deno.Command("bash", { args: ["-lc", p.command] });
      const o = await cmd.output();
      const out = new TextDecoder().decode(o.stdout) + new TextDecoder().decode(o.stderr);
      return { content: [txt(out.slice(0, 8000) || "(no output)")], details: { code: o.code } };
    },
  },
];

const SYSTEM = `You are a Codex-like desktop agent that can SEE and CONTROL this ${IS_WIN ? "Windows" : "macOS"} machine.

You have computer-use tools: screenshot, click, move, type, key, scroll, shell.
- ALWAYS take a screenshot first to see the screen before acting.
- Coordinates are in the screenshot's pixel space (${SCREEN_W}x${SCREEN_H}, top-left origin).
- After each action you get a fresh screenshot — verify the result before the next step.
- ${IS_WIN
    ? 'Open apps via the Start menu: key "win", type the name, key "return".'
    : 'Open apps with Spotlight: key "cmd+space", type the name, key "return".'}
- Be careful and deliberate. Narrate what you're doing in short sentences.
- For coding questions, just answer directly without the computer unless asked to act.`;

// ---------------------------------------------------------------------------
// Agent + event fan-out to SSE clients
// ---------------------------------------------------------------------------
const clients = new Set<(e: unknown) => void>();
function broadcast(ev: unknown) {
  for (const send of clients) {
    try { send(ev); } catch { /* ignore */ }
  }
}

// Non-fatal: if codex auth fails (e.g. token needs re-login), the window and
// UI still come up; the agent surfaces the error when you send a message.
await refreshCodex().catch((e) =>
  console.error("codex auth deferred — run `codex login` to restore:", e?.message ?? e)
);
const agent = new Agent({ getApiKey: async () => await codexApiKey() });
agent.setModel(getModel("openai-codex", MODEL_ID as never));
agent.setSystemPrompt(SYSTEM);
agent.setTools(tools as never);
agent.subscribe((e) => broadcast(e));

// ---------------------------------------------------------------------------
// HTTP: chat UI + SSE + prompt intake. Deno.serve auto-binds to the port the
// webview navigates to in desktop mode.
// ---------------------------------------------------------------------------
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Codex Desktop</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, system-ui, sans-serif;
         background: #0d0d12; color: #e8e8ee; height: 100vh; display: flex; flex-direction: column; }
  header { padding: 10px 14px; background: #15151d; border-bottom: 1px solid #26263a;
           display: flex; align-items: center; gap: 8px; font-weight: 600; }
  header .dot { width: 8px; height: 8px; border-radius: 50%; background: #f43f5e; }
  header .dot.on { background: #22c55e; }
  header small { font-weight: 400; color: #8a8aa0; margin-left: auto; }
  #log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .msg { max-width: 92%; padding: 9px 12px; border-radius: 12px; white-space: pre-wrap; word-wrap: break-word; }
  .user { align-self: flex-end; background: #4f46e5; }
  .assistant { align-self: flex-start; background: #1c1c28; }
  .tool { align-self: flex-start; background: #14141e; border: 1px solid #2a2a3e; color: #b9b9d0;
          font-family: ui-monospace, monospace; font-size: 12px; border-radius: 8px; }
  .tool b { color: #818cf8; }
  .shot { align-self: flex-start; max-width: 92%; }
  .shot img { width: 100%; border-radius: 8px; border: 1px solid #2a2a3e; display: block; }
  form { display: flex; gap: 8px; padding: 10px; background: #15151d; border-top: 1px solid #26263a; }
  textarea { flex: 1; resize: none; background: #0d0d12; color: #e8e8ee; border: 1px solid #2a2a3e;
             border-radius: 10px; padding: 9px 11px; font: inherit; height: 42px; }
  button { background: #4f46e5; color: #fff; border: 0; border-radius: 10px; padding: 0 16px; cursor: pointer; font-weight: 600; }
  button:disabled { opacity: .5; cursor: default; }
</style>
</head>
<body>
  <header><span class="dot" id="dot"></span> Codex Desktop <small id="meta">connecting…</small></header>
  <div id="log"></div>
  <form id="f">
    <textarea id="i" placeholder="Ask, or tell it to do something on your Mac…" autofocus></textarea>
    <button id="send">Send</button>
  </form>

<script>
const log = document.getElementById("log");
const meta = document.getElementById("meta");
const dot = document.getElementById("dot");
const form = document.getElementById("f");
const input = document.getElementById("i");

let cur = null; // current assistant bubble being streamed
const seenTools = new Set();

function el(cls, html) { const d = document.createElement("div"); d.className = cls; if (html != null) d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
function esc(s) { return (s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

// Render the content blocks of an assistant message: text + tool calls + screenshots.
function renderAssistant(message) {
  let text = "";
  for (const b of (message.content || [])) {
    if (b.type === "text") text += b.text;
    else if (b.type === "toolCall" || b.type === "tool_use") {
      const id = b.id || b.toolCallId || JSON.stringify(b.arguments || b.input);
      if (!seenTools.has("call:" + id)) {
        seenTools.add("call:" + id);
        const name = b.name || b.toolName;
        const args = JSON.stringify(b.arguments ?? b.input ?? {});
        el("msg tool", \`🔧 <b>\${esc(name)}</b> \${esc(args)}\`);
      }
    }
  }
  if (text) {
    if (!cur) cur = el("msg assistant", "");
    cur.textContent = text;
    log.scrollTop = log.scrollHeight;
  }
}

// Tool results may carry screenshots (image blocks) — render them.
function renderToolResults(results) {
  for (const r of (results || [])) {
    const id = r.toolCallId || r.id;
    for (const b of (r.content || [])) {
      if (b.type === "image" && b.data) {
        if (seenTools.has("img:" + id + (b.data.length))) continue;
        seenTools.add("img:" + id + (b.data.length));
        const wrap = el("shot");
        const im = document.createElement("img");
        im.src = "data:" + (b.mimeType || "image/png") + ";base64," + b.data;
        wrap.appendChild(im);
        log.scrollTop = log.scrollHeight;
      }
    }
  }
}

const ev = new EventSource("/events");
ev.onopen = () => { dot.classList.add("on"); };
ev.onerror = () => { dot.classList.remove("on"); };
ev.onmessage = (e) => {
  const m = JSON.parse(e.data);
  switch (m.type) {
    case "hello": meta.textContent = m.model + " · " + m.screen.join("×"); break;
    case "turn_start": cur = null; break;
    case "message_start": cur = null; if (m.message) renderAssistant(m.message); break;
    case "message_update": if (m.message) renderAssistant(m.message); break;
    case "message_end": if (m.message) renderAssistant(m.message); cur = null; break;
    case "turn_end": if (m.message) renderAssistant(m.message); renderToolResults(m.toolResults); cur = null; break;
    case "agent_end": cur = null; setBusy(false); break;
    case "error": el("msg tool", "⚠️ " + esc(m.message)); setBusy(false); break;
  }
};

function setBusy(b) { document.getElementById("send").disabled = b; }

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  el("msg user").textContent = text;
  input.value = ""; cur = null; setBusy(true);
  await fetch("/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text }) });
});
input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
</script>
</body>
</html>
`;

const server = Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/") {
    return new Response(indexHtml, { headers: { "content-type": "text/html" } });
  }
  if (url.pathname === "/events") {
    const stream = new ReadableStream({
      start(controller) {
        const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        clients.add(send);
        send({ type: "hello", model: MODEL_ID, screen: [SCREEN_W, SCREEN_H] });
        req.signal.addEventListener("abort", () => { clients.delete(send); try { controller.close(); } catch { /**/ } });
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
    });
  }
  if (url.pathname === "/chat" && req.method === "POST") {
    const { message } = await req.json();
    // fire-and-forget; events stream over SSE
    agent.prompt(String(message)).catch((e) => broadcast({ type: "error", message: String(e?.message ?? e) }));
    return new Response("ok");
  }
  return new Response("not found", { status: 404 });
});

const addr = `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`;
console.log(`codex-demo on ${addr}  (model ${MODEL_ID}, screen ${SCREEN_W}x${SCREEN_H})`);

// Desktop mode: open a native CEF window. Plain mode: just print the URL.
// deno-lint-ignore no-explicit-any
const DenoAny = Deno as any;
if (DenoAny.BrowserWindow) {
  const win = new DenoAny.BrowserWindow({ title: "Codex Desktop", width: 480, height: 720 });
  win.navigate(addr);
  win.addEventListener("close", () => Deno.exit(0));
}
