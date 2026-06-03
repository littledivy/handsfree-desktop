import type { Agent } from "@mariozechner/pi-agent-core";
import { encodeBase64 } from "@std/encoding/base64";

export interface AppInfo {
  agent: Agent;
  html: string;
  model: string;
  screen: [number, number];
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
const errorEvent = (e: unknown) => ({
  type: "error",
  message: String((e as Error)?.message ?? e),
});

export function startTransport(app: AppInfo): void {
  const ctor =
    (Deno as unknown as { BrowserWindow?: DesktopWindowCtor }).BrowserWindow;
  if (ctor) startDesktop(ctor, app);
  else startBrowser(app);
}

function startDesktop(Ctor: DesktopWindowCtor, app: AppInfo): void {
  const { agent, html, model, screen } = app;
  const win = new Ctor({ title: "Codex Desktop", width: 480, height: 760 });

  const pushToUi = (ev: unknown) =>
    win.executeJs(
      `window.__ev && window.__ev(${JSON.stringify(JSON.stringify(ev))})`,
    ).catch(() => {});

  agent.subscribe(pushToUi);
  win.bind("hello", () => Promise.resolve(JSON.stringify({ model, screen })));
  win.bind("sendMessage", (text) => {
    agent.prompt(String(text)).catch((e) => pushToUi(errorEvent(e)));
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
  console.log(
    `codex-demo desktop  (model ${model}, screen ${screen.join("x")})`,
  );
}

function startBrowser(app: AppInfo): void {
  const { agent, html, model, screen } = app;
  const clients = new Set<(e: unknown) => void>();
  const pushToUi = (ev: unknown) => {
    for (const s of clients) {
      try {
        s(ev);
      } catch {
        clients.delete(s);
      }
    }
  };
  agent.subscribe(pushToUi);

  const server = Deno.serve((req) => {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response(html, { headers: { "content-type": "text/html" } });
    }
    if (url.pathname === "/events") {
      const stream = new ReadableStream({
        start(controller) {
          const send = (e: unknown) =>
            controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
          clients.add(send);
          send({ type: "hello", model, screen });
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
        agent.prompt(String(message)).catch((e) => pushToUi(errorEvent(e)));
        return new Response("ok");
      });
    }
    return new Response("not found", { status: 404 });
  });
  console.log(
    `codex-demo on http://127.0.0.1:${
      (server.addr as Deno.NetAddr).port
    }  (model ${model}, screen ${screen.join("x")})`,
  );
}
