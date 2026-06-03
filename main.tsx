/** @jsxRuntime classic */
/** @jsx h */

// codex-demo — a Codex-like desktop app: chat UI + hands-free computer use.
// Brain: OpenAI Codex (via pi-ai OAuth, using your ~/.codex creds).
// Loop: @mariozechner/pi-agent-core. Computer use: Deno FFI (macos.ts / win32.ts).
//
// The chat UI is rendered to an HTML string *server-side* from the JSX below —
// no client framework, no bundler. The desktop window loads it as a `data:`
// URL (no web server) and talks back over typed BrowserWindow bindings; a
// plain `deno run` falls back to a dev server (SSE + fetch) for the browser.

import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { refreshOpenAICodexToken } from "@mariozechner/pi-ai/oauth";
import { z } from "zod";
import { encodeBase64 } from "@std/encoding/base64";
import type { ComputerUse } from "./macos.ts";

const HOME = (Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE"))!;
const MODEL_ID = Deno.env.get("CODEX_MODEL") ?? "gpt-5.4";
const enc = new TextEncoder();

// ─── Server-side JSX ─────────────────────────────────────────────────────────
// Tiny string renderer. `h` returns `Html` (pre-rendered markup); text children
// are escaped, `raw()` children pass through verbatim.

class Html {
  constructor(readonly value: string) {}
}
function raw(value: string): Html {
  return new Html(value);
}
function escape(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
type Child = Html | string | number | boolean | null | undefined | Child[];
function renderChild(child: Child): string {
  if (child == null || child === false || child === true) return "";
  if (child instanceof Html) return child.value;
  if (Array.isArray(child)) return child.map(renderChild).join("");
  return escape(String(child));
}
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);
function renderAttrs(props: Record<string, unknown> | null): string {
  if (!props) return "";
  let out = "";
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || value == null || value === false) continue;
    const name = key === "className" ? "class" : key;
    if (value === true) out += ` ${name}`;
    else out += ` ${name}="${escape(String(value))}"`;
  }
  return out;
}
type Component = (props: Record<string, unknown>) => Html;
function h(
  tag: string | Component,
  props: Record<string, unknown> | null,
  ...children: Child[]
): Html {
  if (typeof tag === "function") return tag({ ...props, children });
  const inner = children.map(renderChild).join("");
  if (VOID_TAGS.has(tag)) return raw(`<${tag}${renderAttrs(props)}>`);
  return raw(`<${tag}${renderAttrs(props)}>${inner}</${tag}>`);
}
declare global {
  namespace JSX {
    type Element = Html;
    interface ElementChildrenAttribute {
      children: Record<never, never>;
    }
    interface IntrinsicElements {
      [tag: string]: Record<string, unknown>;
    }
  }
}

// ─── Codex auth ──────────────────────────────────────────────────────────────
// Refresh the access token from ~/.codex/auth.json, keep it fresh.

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

// ─── Computer use ────────────────────────────────────────────────────────────
// Load the matching FFI backend at runtime — no bundling, the other never loads.

const IS_WIN = Deno.build.os === "windows";
const computer: ComputerUse =
  await (IS_WIN ? import("./win32.ts") : import("./macos.ts"))
    .then((m) => m.createComputerUse());
const { screenW: SCREEN_W, screenH: SCREEN_H } = computer;

async function screenshot(): Promise<string> {
  return encodeBase64(await computer.capturePng());
}
function img(b64: string) {
  return { type: "image" as const, data: b64, mimeType: "image/png" };
}
function txt(s: string) {
  return { type: "text" as const, text: s };
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Tools (zod-validated) ───────────────────────────────────────────────────
// Each tool declares its parameters with a zod schema. The JSON Schema handed
// to the model is derived from it, and incoming arguments are parsed/validated
// against it before `run` sees them.

// deno-lint-ignore no-explicit-any
type ToolContent = { content: any[]; details: Record<string, unknown> };
function tool<S extends z.ZodType>(def: {
  name: string;
  description: string;
  parameters: S;
  run: (p: z.infer<S>) => Promise<ToolContent> | ToolContent;
}) {
  return {
    name: def.name,
    label: def.name,
    description: def.description,
    parameters: z.toJSONSchema(def.parameters),
    execute: (_id: string, args: unknown) =>
      def.run(def.parameters.parse(args)),
  };
}

const tools = [
  tool({
    name: "screenshot",
    description:
      `Capture the current screen. Returns a ${SCREEN_W}x${SCREEN_H} image; ` +
      `all click/move coordinates are in this pixel space (top-left origin).`,
    parameters: z.object({}),
    run: async () => ({
      content: [txt(`screen ${SCREEN_W}x${SCREEN_H}`), img(await screenshot())],
      details: {},
    }),
  }),
  tool({
    name: "click",
    description:
      "Left-click at (x, y). Set double=true for double-click, right=true for right-click.",
    parameters: z.object({
      x: z.number(),
      y: z.number(),
      double: z.boolean().optional(),
      right: z.boolean().optional(),
    }),
    run: async (p) => {
      computer.click(p.x, p.y, { double: p.double, right: p.right });
      await pause(300);
      return {
        content: [txt(`clicked ${p.x},${p.y}`), img(await screenshot())],
        details: {},
      };
    },
  }),
  tool({
    name: "move",
    description: "Move the mouse to (x, y) without clicking.",
    parameters: z.object({ x: z.number(), y: z.number() }),
    run: (p) => {
      computer.move(p.x, p.y);
      return { content: [txt(`moved ${p.x},${p.y}`)], details: {} };
    },
  }),
  tool({
    name: "type",
    description: "Type the given text at the current focus.",
    parameters: z.object({ text: z.string() }),
    run: async (p) => {
      computer.type(p.text);
      await pause(200);
      return {
        content: [txt(`typed ${p.text.length} chars`), img(await screenshot())],
        details: {},
      };
    },
  }),
  tool({
    name: "key",
    description:
      'Press a key or combo, e.g. "return", "cmd+space", "cmd+shift+4", "escape".',
    parameters: z.object({ keys: z.string() }),
    run: async (p) => {
      computer.key(p.keys);
      await pause(250);
      return {
        content: [txt(`pressed ${p.keys}`), img(await screenshot())],
        details: {},
      };
    },
  }),
  tool({
    name: "scroll",
    description:
      "Scroll by (dx, dy) pixels. Positive dy scrolls up, negative down.",
    parameters: z.object({ dx: z.number(), dy: z.number() }),
    run: async (p) => {
      computer.scroll(p.dx, p.dy);
      await pause(250);
      return {
        content: [txt(`scrolled ${p.dx},${p.dy}`), img(await screenshot())],
        details: {},
      };
    },
  }),
  tool({
    name: "shell",
    description:
      "Run a shell command (PowerShell on Windows, bash on macOS) and return output.",
    parameters: z.object({ command: z.string() }),
    run: async (p) => {
      const cmd = IS_WIN
        ? new Deno.Command("powershell", {
          args: ["-NoProfile", "-Command", p.command],
        })
        : new Deno.Command("bash", { args: ["-lc", p.command] });
      const o = await cmd.output();
      const out = new TextDecoder().decode(o.stdout) +
        new TextDecoder().decode(o.stderr);
      return {
        content: [txt(out.slice(0, 8000) || "(no output)")],
        details: { code: o.code },
      };
    },
  }),
];

const SYSTEM =
  `You are a Codex-like desktop agent that can SEE and CONTROL this ${
    IS_WIN ? "Windows" : "macOS"
  } machine.

You have computer-use tools: screenshot, click, move, type, key, scroll, shell.
- ALWAYS take a screenshot first to see the screen before acting.
- Coordinates are in the screenshot's pixel space (${SCREEN_W}x${SCREEN_H}, top-left origin).
- After each action you get a fresh screenshot — verify the result before the next step.
- ${
    IS_WIN
      ? 'Open apps via the Start menu: key "win", type the name, key "return".'
      : 'Open apps with Spotlight: key "cmd+space", type the name, key "return".'
  }
- Be careful and deliberate. Narrate what you're doing in short sentences.
- For coding questions, just answer directly without the computer unless asked to act.`;

// ─── Agent ───────────────────────────────────────────────────────────────────
// Non-fatal: if codex auth fails (e.g. token needs re-login), the window and UI
// still come up; the agent surfaces the error when you send a message.

await refreshCodex().catch((e) =>
  console.error(
    "codex auth deferred — run `codex login` to restore:",
    e?.message ?? e,
  )
);
const agent = new Agent({ getApiKey: async () => await codexApiKey() });
agent.setModel(getModel("openai-codex", MODEL_ID as never));
agent.setSystemPrompt(SYSTEM);
agent.setTools(tools as never);

// ─── Page (server-rendered JSX) ──────────────────────────────────────────────

const STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; background: #0d0d12; color: #e8e8ee; }
  .app { height: 100%; display: flex; flex-direction: column; }
  header { padding: 10px 14px; background: #15151d; border-bottom: 1px solid #26263a; display: flex; align-items: center; gap: 8px; font-weight: 600; }
  header .dot { width: 8px; height: 8px; border-radius: 50%; background: #f43f5e; }
  header .dot.on { background: #22c55e; }
  header small { font-weight: 400; color: #8a8aa0; margin-left: auto; }
  .log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .msg { max-width: 92%; padding: 9px 12px; border-radius: 12px; white-space: pre-wrap; word-wrap: break-word; }
  .user { align-self: flex-end; background: #4f46e5; }
  .assistant { align-self: flex-start; background: #1c1c28; }
  .tool { align-self: flex-start; background: #14141e; border: 1px solid #2a2a3e; color: #b9b9d0; font-family: ui-monospace, monospace; font-size: 12px; border-radius: 8px; }
  .tool b { color: #818cf8; }
  .shot { align-self: flex-start; max-width: 92%; }
  .shot img { width: 100%; border-radius: 8px; border: 1px solid #2a2a3e; display: block; }
  form { display: flex; gap: 8px; padding: 10px; background: #15151d; border-top: 1px solid #26263a; }
  textarea { flex: 1; resize: none; background: #0d0d12; color: #e8e8ee; border: 1px solid #2a2a3e; border-radius: 10px; padding: 9px 11px; font: inherit; height: 42px; }
  button { background: #4f46e5; color: #fff; border: 0; border-radius: 10px; padding: 0 16px; cursor: pointer; font-weight: 600; }
  button:disabled { opacity: .5; cursor: default; }
`;

// Client glue: plain DOM, no framework, no bundle. Interprets AgentEvents from
// the runtime (over BrowserWindow bindings in desktop mode, SSE in the browser)
// and appends chat bubbles. Mirrors the old Preact reducer.
const CLIENT_JS = `
const seen = new Set();
const log = document.getElementById("log");
const dotEl = document.getElementById("dot");
const metaEl = document.getElementById("meta");
const draftEl = document.getElementById("draft");
const sendBtn = document.getElementById("send");
const formEl = document.getElementById("form");

const scrollDown = () => { log.scrollTop = log.scrollHeight; };
const bubble = (cls, text) => {
  const d = document.createElement("div");
  d.className = cls;
  if (text != null) d.textContent = text;
  return d;
};

function addUser(text) { log.appendChild(bubble("msg user", text)); scrollDown(); }
function addAssistant(text) {
  const last = log.lastElementChild;
  if (last && last.classList.contains("assistant")) last.textContent = text;
  else log.appendChild(bubble("msg assistant", text));
  scrollDown();
}
function addTool(id, name, args) {
  if (seen.has("c" + id)) return;
  seen.add("c" + id);
  const d = bubble("msg tool");
  const b = document.createElement("b");
  b.textContent = name === "error" ? "⚠️" : "🔧 " + name;
  d.appendChild(b);
  d.appendChild(document.createTextNode(" " + args));
  log.appendChild(d);
  scrollDown();
}
function addShot(id, src) {
  if (seen.has("s" + id)) return;
  seen.add("s" + id);
  const d = bubble("shot");
  const im = document.createElement("img");
  im.src = src;
  d.appendChild(im);
  log.appendChild(d);
  scrollDown();
}
const setBusy = (b) => { sendBtn.disabled = b; };
const setMeta = (t) => { metaEl.textContent = t; };
const setConnected = (c) => { dotEl.classList.toggle("on", c); };

function renderMsg(msg) {
  let text = "";
  for (const b of (msg && msg.content) || []) {
    if (b.type === "text") text += b.text;
    else if (b.type === "toolCall" || b.type === "tool_use") {
      addTool(
        String(b.id ?? b.toolCallId ?? JSON.stringify(b.arguments ?? b.input)),
        b.name ?? b.toolName,
        JSON.stringify(b.arguments ?? b.input ?? {}),
      );
    }
  }
  if (text) addAssistant(text);
}
function onEvent(m) {
  switch (m.type) {
    case "hello":
      setMeta(m.model + " · " + m.screen.join("×"));
      break;
    case "message_start":
    case "message_update":
    case "message_end":
      if (m.message) renderMsg(m.message);
      break;
    case "turn_end":
      if (m.message) renderMsg(m.message);
      for (const r of m.toolResults || []) {
        for (const b of r.content || []) {
          if (b.type === "image" && b.data) {
            addShot(
              (r.toolCallId ?? r.id ?? "") + b.data.length,
              "data:" + (b.mimeType || "image/png") + ";base64," + b.data,
            );
          }
        }
      }
      break;
    case "agent_end":
      setBusy(false);
      break;
    case "error":
      addTool("err" + Math.random(), "error", m.message);
      setBusy(false);
      break;
  }
}

let send = () => {};
if (window.bindings) {
  // Desktop: direct RPC over BrowserWindow bindings — no web server.
  window.__ev = (s) => onEvent(JSON.parse(s));
  setConnected(true);
  window.bindings.hello().then((h) => {
    const x = JSON.parse(h);
    setMeta(x.model + " · " + x.screen.join("×"));
  });
  send = (t) => window.bindings.sendMessage(t);
} else {
  // Browser dev: SSE + fetch.
  const es = new EventSource("/events");
  es.onopen = () => setConnected(true);
  es.onerror = () => setConnected(false);
  es.onmessage = (e) => onEvent(JSON.parse(e.data));
  send = (t) =>
    fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: t }),
    });
}

function submit() {
  const text = draftEl.value.trim();
  if (!text) return;
  addUser(text);
  setBusy(true);
  draftEl.value = "";
  send(text);
}
formEl.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
draftEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
});
`;

function Page(): Html {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Codex Desktop</title>
        <style>{raw(STYLES)}</style>
      </head>
      <body>
        <div class="app">
          <header>
            <span id="dot" class="dot"></span>
            Codex Desktop
            <small id="meta">connecting…</small>
          </header>
          <div class="log" id="log"></div>
          <form id="form">
            <textarea
              id="draft"
              placeholder="Ask, or tell it to do something on your machine…"
            >
            </textarea>
            <button id="send" type="submit">Send</button>
          </form>
        </div>
        <script>{raw(CLIENT_JS)}</script>
      </body>
    </html>
  );
}

const HTML = "<!DOCTYPE html>" + renderChild(<Page />);

// ─── Transport ───────────────────────────────────────────────────────────────
// Desktop: typed BrowserWindow bindings, page loaded as a data: URL (no server).
// Browser dev (`deno run`): a small Deno.serve with SSE + /chat.

interface DesktopWindow {
  bind(name: string, fn: (...args: unknown[]) => Promise<unknown>): void;
  executeJs(code: string): Promise<unknown>;
  navigate(url: string): void;
  addEventListener(type: "close", fn: () => void): void;
}
type DesktopWindowCtor = new (
  opts: { title?: string; width?: number; height?: number },
) => DesktopWindow;

let emit: (ev: unknown) => void = () => {};
agent.subscribe((e) => emit(e));

const BrowserWindowCtor =
  (Deno as unknown as { BrowserWindow?: DesktopWindowCtor }).BrowserWindow;

if (BrowserWindowCtor) {
  const win = new BrowserWindowCtor({
    title: "Codex Desktop",
    width: 480,
    height: 760,
  });
  win.bind("hello", () =>
    Promise.resolve(
      JSON.stringify({ model: MODEL_ID, screen: [SCREEN_W, SCREEN_H] }),
    ));
  win.bind("sendMessage", (text) => {
    agent.prompt(String(text)).catch((e) =>
      emit({ type: "error", message: String((e as Error)?.message ?? e) })
    );
    return Promise.resolve(null);
  });
  emit = (ev) => {
    win.executeJs(
      `window.__ev && window.__ev(${JSON.stringify(JSON.stringify(ev))})`,
    ).catch(() => {});
  };
  win.addEventListener("close", () => Deno.exit(0));
  // No web server: the page is loaded straight into the webview as a data: URL.
  // The desktop runtime force-navigates the window to its (unused) serve address
  // ~15s in, so re-assert ours once past that.
  const page = "data:text/html;charset=utf-8;base64," +
    encodeBase64(enc.encode(HTML));
  win.navigate(page);
  setTimeout(() => win.navigate(page), 15_500);
  console.log(
    `codex-demo desktop  (model ${MODEL_ID}, screen ${SCREEN_W}x${SCREEN_H})`,
  );
  await new Promise<void>(() => {}); // keep the runtime + window alive
} else {
  const clients = new Set<(e: unknown) => void>();
  emit = (ev) => {
    for (const s of clients) {
      try {
        s(ev);
      } catch { /* ignore */ }
    }
  };
  const server = Deno.serve((req) => {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response(HTML, { headers: { "content-type": "text/html" } });
    }
    if (url.pathname === "/events") {
      const stream = new ReadableStream({
        start(controller) {
          const send = (e: unknown) =>
            controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
          clients.add(send);
          send({
            type: "hello",
            model: MODEL_ID,
            screen: [SCREEN_W, SCREEN_H],
          });
          req.signal.addEventListener("abort", () => {
            clients.delete(send);
            try {
              controller.close();
            } catch { /* ignore */ }
          });
        },
      });
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    }
    if (url.pathname === "/chat" && req.method === "POST") {
      return req.json().then(({ message }: { message: string }) => {
        agent.prompt(String(message)).catch((e) =>
          emit({ type: "error", message: String((e as Error)?.message ?? e) })
        );
        return new Response("ok");
      });
    }
    return new Response("not found", { status: 404 });
  });
  console.log(
    `codex-demo on http://127.0.0.1:${
      (server.addr as Deno.NetAddr).port
    }  (model ${MODEL_ID}, screen ${SCREEN_W}x${SCREEN_H})`,
  );
}
