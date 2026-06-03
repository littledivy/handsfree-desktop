/** @jsxRuntime classic */
/** @jsx h */

import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { refreshOpenAICodexToken } from "@mariozechner/pi-ai/oauth";
import { transpile } from "@deno/emit";
import { z } from "zod";
import { encodeBase64 } from "@std/encoding/base64";
import type { ComputerUse } from "./macos.ts";

const HOME = (Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE"))!;
const MODEL_ID = Deno.env.get("CODEX_MODEL") ?? "gpt-5.4";
const enc = new TextEncoder();
const PREACT = "https://esm.sh/preact@10.27.2";

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

type ToolContent = { content: unknown[]; details: Record<string, unknown> };
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

const uiUrl = new URL("./ui.tsx", import.meta.url);
const uiSrc = await Deno.readTextFile(uiUrl);
const uiJs = (await transpile(uiUrl, {
  load: (spec) =>
    Promise.resolve(
      spec === uiUrl.href
        ? { kind: "module", specifier: spec, content: uiSrc }
        : { kind: "external", specifier: spec },
    ),
  compilerOptions: { jsx: "react-jsx", jsxImportSource: PREACT },
})).get(uiUrl.href)!;

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
        <div id="root"></div>
        <script type="module">{raw(uiJs)}</script>
      </body>
    </html>
  );
}
const HTML = "<!DOCTYPE html>" + renderChild(<Page />);

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
  const keepAlive = setInterval(() => {}, 1 << 30);
  win.addEventListener("close", () => {
    clearInterval(keepAlive);
    Deno.exit(0);
  });
  const page = "data:text/html;charset=utf-8;base64," +
    encodeBase64(enc.encode(HTML));
  win.navigate(page);
  setTimeout(() => win.navigate(page), 15_500);
  console.log(
    `codex-demo desktop  (model ${MODEL_ID}, screen ${SCREEN_W}x${SCREEN_H})`,
  );
} else {
  const clients = new Set<(e: unknown) => void>();
  emit = (ev) => {
    for (const s of clients) {
      try {
        s(ev);
      } catch {
        clients.delete(s);
      }
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
            } catch {
              void 0;
            }
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
