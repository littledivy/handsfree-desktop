// codex-demo — a Codex-like desktop app: chat UI + hands-free computer use.
// Brain: OpenAI Codex (via pi-ai OAuth, using your ~/.codex creds).
// Loop: @mariozechner/pi-agent-core. Computer use: Deno FFI (no helper binary).
// UI: Preact (ui.tsx). Desktop (`deno desktop`) talks to the runtime via
// BrowserWindow bindings; in the browser it falls back to SSE + fetch.
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { refreshOpenAICodexToken } from "@mariozechner/pi-ai/oauth";
import { Type } from "@sinclair/typebox";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { encode as encodePng } from "npm:fast-png";

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
// Computer use via Deno FFI — no native helper binary.
//   macOS: CoreGraphics (CGEvent) for input, `screencapture` for vision.
//   Windows: user32 SendInput for input, gdi32 BitBlt + fast-png for capture.
// Run with --allow-ffi (covered by -A).
// ---------------------------------------------------------------------------
const IS_WIN = Deno.build.os === "windows";

let SCREEN_W = 0, SCREEN_H = 0;
let moveMouse: (x: number, y: number) => void;
let clickMouse: (x: number, y: number, double: boolean, right: boolean) => void;
let scrollMouse: (dx: number, dy: number) => void;
let typeText: (s: string) => void;
let pressCombo: (combo: string) => void;
let capturePng: () => Promise<Uint8Array>;

if (IS_WIN) {
  const u = Deno.dlopen("user32.dll", {
    SendInput: { parameters: ["u32", "buffer", "i32"], result: "u32" },
    SetCursorPos: { parameters: ["i32", "i32"], result: "bool" },
    GetSystemMetrics: { parameters: ["i32"], result: "i32" },
    SetProcessDPIAware: { parameters: [], result: "bool" },
    VkKeyScanW: { parameters: ["u16"], result: "i16" },
    GetDC: { parameters: ["pointer"], result: "pointer" },
    ReleaseDC: { parameters: ["pointer", "pointer"], result: "i32" },
  } as const);
  const g = Deno.dlopen("gdi32.dll", {
    CreateCompatibleDC: { parameters: ["pointer"], result: "pointer" },
    CreateCompatibleBitmap: { parameters: ["pointer", "i32", "i32"], result: "pointer" },
    SelectObject: { parameters: ["pointer", "pointer"], result: "pointer" },
    BitBlt: { parameters: ["pointer", "i32", "i32", "i32", "i32", "pointer", "i32", "i32", "u32"], result: "bool" },
    GetDIBits: { parameters: ["pointer", "pointer", "u32", "u32", "buffer", "buffer", "u32"], result: "i32" },
    DeleteObject: { parameters: ["pointer"], result: "bool" },
    DeleteDC: { parameters: ["pointer"], result: "bool" },
  } as const);

  u.symbols.SetProcessDPIAware();
  SCREEN_W = u.symbols.GetSystemMetrics(0);
  SCREEN_H = u.symbols.GetSystemMetrics(1);

  const send = (...inputs: Uint8Array[]) => {
    const buf = new Uint8Array(40 * inputs.length);
    inputs.forEach((b, i) => buf.set(b, i * 40));
    u.symbols.SendInput(inputs.length, buf, 40);
  };
  const mi = (dx: number, dy: number, data: number, flags: number) => {
    const b = new Uint8Array(40), v = new DataView(b.buffer);
    v.setUint32(0, 0, true); v.setInt32(8, dx, true); v.setInt32(12, dy, true);
    v.setUint32(16, data >>> 0, true); v.setUint32(20, flags >>> 0, true);
    return b;
  };
  const ki = (vk: number, scan: number, flags: number) => {
    const b = new Uint8Array(40), v = new DataView(b.buffer);
    v.setUint32(0, 1, true); v.setUint16(8, vk, true); v.setUint16(10, scan, true);
    v.setUint32(12, flags >>> 0, true);
    return b;
  };
  const ABS = 0x8000, MOVE = 1, LD = 2, LU = 4, RD = 8, RU = 0x10, WHEEL = 0x800, HWHEEL = 0x1000, KEYUP = 2, UNI = 4;
  const abs = (x: number, sz: number) => Math.round(x * 65535 / sz);
  moveMouse = (x, y) => { send(mi(abs(x, SCREEN_W), abs(y, SCREEN_H), 0, MOVE | ABS)); u.symbols.SetCursorPos(x, y); };
  clickMouse = (x, y, dbl, right) => {
    moveMouse(x, y);
    const d = right ? RD : LD, up = right ? RU : LU;
    send(mi(0, 0, 0, d), mi(0, 0, 0, up));
    if (dbl) send(mi(0, 0, 0, d), mi(0, 0, 0, up));
  };
  scrollMouse = (dx, dy) => { if (dy) send(mi(0, 0, dy, WHEEL)); if (dx) send(mi(0, 0, dx, HWHEEL)); };
  typeText = (s) => { for (const ch of s) { const c = ch.charCodeAt(0); send(ki(0, c, UNI), ki(0, c, UNI | KEYUP)); } };
  const VK: Record<string, number> = {
    return: 0x0D, enter: 0x0D, tab: 0x09, space: 0x20, escape: 0x1B, esc: 0x1B, backspace: 0x08, delete: 0x2E,
    up: 0x26, down: 0x28, left: 0x25, right: 0x27, home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22,
  };
  const vkOf = (k: string) => k in VK ? VK[k]
    : k.length === 1 ? (u.symbols.VkKeyScanW(k.toUpperCase().charCodeAt(0)) & 0xff)
    : /^f\d+$/.test(k) ? 0x70 + (+k.slice(1)) - 1 : 0;
  pressCombo = (combo) => {
    const mods: number[] = []; let key = 0;
    for (const p of combo.toLowerCase().split("+")) {
      if (p === "ctrl" || p === "control") mods.push(0x11);
      else if (p === "shift") mods.push(0x10);
      else if (p === "alt" || p === "option") mods.push(0x12);
      else if (p === "cmd" || p === "win" || p === "meta" || p === "super") mods.push(0x5B);
      else key = vkOf(p);
    }
    for (const m of mods) send(ki(m, 0, 0));
    if (key) { send(ki(key, 0, 0)); send(ki(key, 0, KEYUP)); }
    for (const m of mods.reverse()) send(ki(m, 0, KEYUP));
  };
  capturePng = () => {
    const screen = u.symbols.GetDC(null);
    const mem = g.symbols.CreateCompatibleDC(screen);
    const bmp = g.symbols.CreateCompatibleBitmap(screen, SCREEN_W, SCREEN_H);
    g.symbols.SelectObject(mem, bmp);
    g.symbols.BitBlt(mem, 0, 0, SCREEN_W, SCREEN_H, screen, 0, 0, 0x00CC0020); // SRCCOPY
    const bmi = new Uint8Array(40), bv = new DataView(bmi.buffer);
    bv.setUint32(0, 40, true); bv.setInt32(4, SCREEN_W, true); bv.setInt32(8, -SCREEN_H, true);
    bv.setUint16(12, 1, true); bv.setUint16(14, 32, true); bv.setUint32(16, 0, true);
    const bits = new Uint8Array(SCREEN_W * SCREEN_H * 4);
    g.symbols.GetDIBits(mem, bmp, 0, SCREEN_H, bits, bmi, 0);
    g.symbols.DeleteObject(bmp); g.symbols.DeleteDC(mem); u.symbols.ReleaseDC(null, screen);
    for (let i = 0; i < bits.length; i += 4) { const b = bits[i]; bits[i] = bits[i + 2]; bits[i + 2] = b; bits[i + 3] = 255; }
    return Promise.resolve(encodePng({ width: SCREEN_W, height: SCREEN_H, data: bits, channels: 4 }));
  };
} else {
  const cg = Deno.dlopen("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics", {
    CGEventSourceCreate: { parameters: ["i32"], result: "pointer" },
    CGEventCreateMouseEvent: { parameters: ["pointer", "u32", { struct: ["f64", "f64"] }, "u32"], result: "pointer" },
    CGEventCreateKeyboardEvent: { parameters: ["pointer", "u16", "bool"], result: "pointer" },
    CGEventCreateScrollWheelEvent: { parameters: ["pointer", "u32", "u32", "i32", "i32"], result: "pointer" },
    CGEventPost: { parameters: ["u32", "pointer"], result: "void" },
    CGEventSetFlags: { parameters: ["pointer", "u64"], result: "void" },
    CGEventSetIntegerValueField: { parameters: ["pointer", "u32", "i64"], result: "void" },
    CGEventKeyboardSetUnicodeString: { parameters: ["pointer", "u64", "buffer"], result: "void" },
    CGMainDisplayID: { parameters: [], result: "u32" },
    CGDisplayPixelsWide: { parameters: ["u32"], result: "u64" },
    CGDisplayPixelsHigh: { parameters: ["u32"], result: "u64" },
  } as const);
  const cf = Deno.dlopen("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation", {
    CFRelease: { parameters: ["pointer"], result: "void" },
  } as const);

  const src = cg.symbols.CGEventSourceCreate(1);
  const HID = 0;
  const pt = (x: number, y: number) => new Uint8Array(new Float64Array([x, y]).buffer);
  // deno-lint-ignore no-explicit-any
  const post = (ev: any) => { if (ev) { cg.symbols.CGEventPost(HID, ev); cf.symbols.CFRelease(ev); } };

  const dsp = cg.symbols.CGMainDisplayID();
  SCREEN_W = Number(cg.symbols.CGDisplayPixelsWide(dsp));
  SCREEN_H = Number(cg.symbols.CGDisplayPixelsHigh(dsp));

  moveMouse = (x, y) => post(cg.symbols.CGEventCreateMouseEvent(src, 5, pt(x, y), 0));
  clickMouse = (x, y, dbl, right) => {
    const btn = right ? 1 : 0, down = right ? 3 : 1, up = right ? 4 : 2;
    const one = (cc: number) => {
      const d = cg.symbols.CGEventCreateMouseEvent(src, down, pt(x, y), btn);
      cg.symbols.CGEventSetIntegerValueField(d, 1, BigInt(cc)); post(d);
      const u2 = cg.symbols.CGEventCreateMouseEvent(src, up, pt(x, y), btn);
      cg.symbols.CGEventSetIntegerValueField(u2, 1, BigInt(cc)); post(u2);
    };
    one(1); if (dbl) one(2);
  };
  scrollMouse = (dx, dy) => post(cg.symbols.CGEventCreateScrollWheelEvent(src, 0, 2, dy, dx));
  typeText = (s) => {
    for (const ch of s) {
      const buf = new Uint8Array(new Uint16Array([...ch].map((c) => c.charCodeAt(0))).buffer);
      const len = BigInt(buf.byteLength / 2);
      const d = cg.symbols.CGEventCreateKeyboardEvent(src, 0, true);
      cg.symbols.CGEventKeyboardSetUnicodeString(d, len, buf); post(d);
      const up = cg.symbols.CGEventCreateKeyboardEvent(src, 0, false);
      cg.symbols.CGEventKeyboardSetUnicodeString(up, len, buf); post(up);
    }
  };
  const KC: Record<string, number> = {
    return: 36, enter: 36, tab: 48, space: 49, delete: 51, escape: 53, esc: 53,
    left: 123, right: 124, down: 125, up: 126,
    a: 0, s: 1, d: 2, f: 3, h: 4, g: 5, z: 6, x: 7, c: 8, v: 9, b: 11, q: 12, w: 13, e: 14, r: 15,
    y: 16, t: 17, o: 31, u: 32, i: 34, p: 35, l: 37, j: 38, k: 40, n: 45, m: 46,
    "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25, "0": 29,
  };
  pressCombo = (combo) => {
    let flags = 0n, key = -1;
    for (const p of combo.toLowerCase().split("+")) {
      if (p === "cmd" || p === "command" || p === "meta" || p === "super") flags |= 0x100000n;
      else if (p === "shift") flags |= 0x20000n;
      else if (p === "alt" || p === "option") flags |= 0x80000n;
      else if (p === "ctrl" || p === "control") flags |= 0x40000n;
      else if (p in KC) key = KC[p];
    }
    if (key < 0) return;
    const d = cg.symbols.CGEventCreateKeyboardEvent(src, key, true);
    cg.symbols.CGEventSetFlags(d, flags); post(d);
    const up = cg.symbols.CGEventCreateKeyboardEvent(src, key, false);
    cg.symbols.CGEventSetFlags(up, flags); post(up);
  };
  capturePng = async () => {
    // screencapture is the simplest reliable path on macOS; downscale to points.
    const raw = await Deno.makeTempFile({ suffix: ".png" });
    const out = await Deno.makeTempFile({ suffix: ".png" });
    await new Deno.Command("screencapture", { args: ["-x", "-t", "png", raw] }).output();
    await new Deno.Command("sips", { args: ["-z", String(SCREEN_H), String(SCREEN_W), raw, "--out", out] }).output();
    const bytes = await Deno.readFile(out);
    await Deno.remove(raw).catch(() => {});
    await Deno.remove(out).catch(() => {});
    return bytes;
  };
}

// Dispatcher kept so the tool definitions below stay unchanged.
function ctl(cmd: string, ...args: string[]): void {
  switch (cmd) {
    case "move": moveMouse(+args[0], +args[1]); break;
    case "click": clickMouse(+args[0], +args[1], false, false); break;
    case "doubleclick": clickMouse(+args[0], +args[1], true, false); break;
    case "rightclick": clickMouse(+args[0], +args[1], false, true); break;
    case "scroll": scrollMouse(+args[0], +args[1]); break;
    case "type": typeText(args[0]); break;
    case "key": pressCombo(args[0]); break;
  }
}

async function screenshot(): Promise<string> {
  return encodeBase64(await capturePng());
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
// Agent
// ---------------------------------------------------------------------------
// Non-fatal: if codex auth fails (e.g. token needs re-login), the window and
// UI still come up; the agent surfaces the error when you send a message.
await refreshCodex().catch((e) =>
  console.error("codex auth deferred — run `codex login` to restore:", e?.message ?? e)
);
const agent = new Agent({ getApiKey: async () => await codexApiKey() });
agent.setModel(getModel("openai-codex", MODEL_ID as never));
agent.setSystemPrompt(SYSTEM);
agent.setTools(tools as never);

// ---------------------------------------------------------------------------
// UI shell — the Preact app (ui.tsx, bundled to ui.js) wrapped in HTML.
// ---------------------------------------------------------------------------
const STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; margin: 0; }
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
const UI_JS = await Deno.readTextFile(new URL("./ui.js", import.meta.url));
const HTML =
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<title>Codex Desktop</title><style>${STYLES}</style></head>` +
  `<body><div id="root"></div><script type="module">${UI_JS}</script></body></html>`;

// ---------------------------------------------------------------------------
// Transport: BrowserWindow bindings in desktop mode (no web server),
// SSE + fetch in the browser.
// ---------------------------------------------------------------------------
let emit: (ev: unknown) => void = () => {};
// deno-lint-ignore no-explicit-any
const DenoAny = Deno as any;

if (DenoAny.BrowserWindow) {
  const win = new DenoAny.BrowserWindow({ title: "Codex Desktop", width: 480, height: 760 });
  win.bind("hello", () => Promise.resolve(JSON.stringify({ model: MODEL_ID, screen: [SCREEN_W, SCREEN_H] })));
  // deno-lint-ignore no-explicit-any
  win.bind("sendMessage", (text: string) => {
    agent.prompt(String(text)).catch((e: any) => emit({ type: "error", message: String(e?.message ?? e) }));
    return Promise.resolve(null);
  });
  emit = (ev) => { win.executeJs(`window.__ev && window.__ev(${JSON.stringify(JSON.stringify(ev))})`).catch(() => {}); };
  win.addEventListener("close", () => Deno.exit(0));
  // The desktop runtime navigates the webview to the Deno.serve address, so we
  // serve only the page here; all realtime RPC (sendMessage + events) rides the
  // bindings above — no SSE, no fetch round-trips.
  Deno.serve(() => new Response(HTML, { headers: { "content-type": "text/html" } }));
  console.log(`codex-demo desktop  (model ${MODEL_ID}, screen ${SCREEN_W}x${SCREEN_H})`);
} else {
  const clients = new Set<(e: unknown) => void>();
  emit = (ev) => { for (const s of clients) { try { s(ev); } catch { /* ignore */ } } };
  const server = Deno.serve((req) => {
    const url = new URL(req.url);
    if (url.pathname === "/") return new Response(HTML, { headers: { "content-type": "text/html" } });
    if (url.pathname === "/events") {
      const stream = new ReadableStream({
        start(controller) {
          const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
          clients.add(send);
          send({ type: "hello", model: MODEL_ID, screen: [SCREEN_W, SCREEN_H] });
          req.signal.addEventListener("abort", () => { clients.delete(send); try { controller.close(); } catch { /* ignore */ } });
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } });
    }
    if (url.pathname === "/chat" && req.method === "POST") {
      return req.json().then(({ message }: { message: string }) => {
        agent.prompt(String(message)).catch((e) => emit({ type: "error", message: String(e?.message ?? e) }));
        return new Response("ok");
      });
    }
    return new Response("not found", { status: 404 });
  });
  console.log(`codex-demo on http://127.0.0.1:${(server.addr as Deno.NetAddr).port}  (model ${MODEL_ID}, screen ${SCREEN_W}x${SCREEN_H})`);
}

agent.subscribe((e) => emit(e));
