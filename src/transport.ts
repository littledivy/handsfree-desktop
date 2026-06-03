import type { Agent } from "@mariozechner/pi-agent-core";
import { encodeBase64 } from "@std/encoding/base64";
import { Chat } from "./chat.ts";
import { renderLog } from "./view.tsx";

export interface AppInfo {
  agent: Agent;
  chat: Chat;
  html: string;
}

interface KeyEvent {
  key: string;
  shiftKey: boolean;
}
interface MouseEvent {
  clientX: number;
  clientY: number;
}
interface DesktopWindow {
  executeJs(code: string): Promise<unknown>;
  navigate(url: string): void;
  addEventListener(type: "keydown", fn: (e: KeyEvent) => void): void;
  addEventListener(type: "click", fn: (e: MouseEvent) => void): void;
  addEventListener(type: "close", fn: () => void): void;
}
type DesktopWindowCtor = new (
  opts: { title?: string; width?: number; height?: number },
) => DesktopWindow;

const enc = new TextEncoder();
const errorOf = (e: unknown) => String((e as Error)?.message ?? e);

export function startTransport({ agent, chat, html }: AppInfo): void {
  const Ctor =
    (Deno as unknown as { BrowserWindow?: DesktopWindowCtor }).BrowserWindow;
  if (!Ctor) throw new Error("Handsfree must run under `deno desktop`.");

  const win = new Ctor({ title: "Handsfree", width: 480, height: 760 });

  const render = () =>
    win.executeJs(
      `(() => {
        const log = document.getElementById("log");
        if (!log) return;
        log.innerHTML = ${JSON.stringify(renderLog(chat.items))};
        const send = document.getElementById("send");
        if (send) send.disabled = ${chat.busy};
        log.scrollTop = log.scrollHeight;
      })()`,
    ).catch(() => {});

  let sending = false;
  const submit = async () => {
    if (sending) return;
    sending = true;
    try {
      const raw = await win.executeJs(
        `(() => { const d = document.getElementById("draft"); if (!d) return ""; const v = d.value; d.value = ""; return v; })()`,
      );
      const text = String(raw ?? "").trim();
      if (!text) return;
      chat.pushUser(text);
      render();
      agent.prompt(text).catch((e) => {
        if (chat.apply({ type: "error", message: errorOf(e) })) render();
      });
    } finally {
      sending = false;
    }
  };

  agent.subscribe((ev) => {
    if (chat.apply(ev)) render();
  });
  win.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) submit();
  });
  win.addEventListener("click", async (e) => {
    const onSend = await win.executeJs(
      `document.elementFromPoint(${e.clientX}, ${e.clientY})?.id === "send"`,
    );
    if (onSend === true) submit();
  });

  const keepAlive = setInterval(() => {}, 1 << 30);
  win.addEventListener("close", () => {
    clearInterval(keepAlive);
    Deno.exit(0);
  });

  const page = "data:text/html;charset=utf-8;base64," +
    encodeBase64(enc.encode(html));
  win.navigate(page);
  setTimeout(() => win.navigate(page), 15_500);
  console.log("handsfree desktop");
}
