import type { Agent } from "@mariozechner/pi-agent-core";
import { encodeBase64 } from "@std/encoding/base64";
import { Chat } from "./chat.ts";
import { renderLog } from "./view.tsx";

export interface AppInfo {
  agent: Agent;
  chat: Chat;
  html: string;
}

interface View {
  log: string;
  busy: boolean;
}

interface DesktopWindow {
  bind(name: string, fn: (...args: unknown[]) => Promise<unknown>): void;
  executeJs(code: string): Promise<unknown>;
  navigate(url: string): void;
  addEventListener(type: "close", fn: () => void): void;
}
type DesktopWindowCtor = new (
  opts: { title?: string; width?: number; height?: number },
) => DesktopWindow;

const enc = new TextEncoder();
const view = (chat: Chat): View => ({
  log: renderLog(chat.items),
  busy: chat.busy,
});
const errorOf = (e: unknown) => String((e as Error)?.message ?? e);

export function startTransport(app: AppInfo): void {
  const ctor =
    (Deno as unknown as { BrowserWindow?: DesktopWindowCtor }).BrowserWindow;
  if (ctor) startDesktop(ctor, app);
  else startBrowser(app);
}

function startDesktop(Ctor: DesktopWindowCtor, { agent, chat, html }: AppInfo) {
  const win = new Ctor({ title: "Handsfree", width: 480, height: 760 });
  const push = () =>
    win.executeJs(`window.__render(${JSON.stringify(view(chat))})`).catch(
      () => {},
    );

  agent.subscribe((ev) => {
    if (chat.apply(ev)) push();
  });
  win.bind("sendMessage", (text) => {
    chat.pushUser(String(text));
    push();
    agent.prompt(String(text)).catch((e) => {
      if (chat.apply({ type: "error", message: errorOf(e) })) push();
    });
    return Promise.resolve(null);
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

function startBrowser({ agent, chat, html }: AppInfo) {
  const clients = new Set<(v: View) => void>();
  const push = () => {
    const v = view(chat);
    for (const c of clients) {
      try {
        c(v);
      } catch {
        clients.delete(c);
      }
    }
  };
  agent.subscribe((ev) => {
    if (chat.apply(ev)) push();
  });

  const server = Deno.serve((req) => {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response(html, { headers: { "content-type": "text/html" } });
    }
    if (url.pathname === "/events") {
      const stream = new ReadableStream({
        start(controller) {
          const send = (v: View) =>
            controller.enqueue(enc.encode(`data: ${JSON.stringify(v)}\n\n`));
          clients.add(send);
          send(view(chat));
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
        chat.pushUser(String(message));
        push();
        agent.prompt(String(message)).catch((e) => {
          if (chat.apply({ type: "error", message: errorOf(e) })) push();
        });
        return new Response("ok");
      });
    }
    return new Response("not found", { status: 404 });
  });
  console.log(
    `handsfree on http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`,
  );
}
