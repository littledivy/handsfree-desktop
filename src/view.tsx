/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h, renderSSR } from "nano-jsx";
import type { Item } from "./chat.ts";

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

const BRIDGE = `
  const draft = document.getElementById("draft");
  const log = document.getElementById("log");
  const sendBtn = document.getElementById("send");
  const dot = document.getElementById("dot");
  const send = () => {
    const t = draft.value.trim();
    if (!t) return;
    draft.value = "";
    if (window.bindings) window.bindings.sendMessage(t);
    else fetch("/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: t }) });
  };
  document.getElementById("form").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  draft.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  window.__render = (v) => { log.innerHTML = v.log; sendBtn.disabled = v.busy; log.scrollTop = log.scrollHeight; };
  const setConnected = (c) => { dot.className = "dot" + (c ? " on" : ""); };
  if (window.bindings) setConnected(true);
  else {
    const es = new EventSource("/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => window.__render(JSON.parse(e.data));
  }
`;

function Log({ items }: { items: Item[] }) {
  return (
    <Fragment>
      {items.map((it, i) =>
        it.kind === "user"
          ? <div key={i} class="msg user">{it.text}</div>
          : it.kind === "assistant"
          ? <div key={i} class="msg assistant">{it.text}</div>
          : it.kind === "tool"
          ? (
            <div key={i} class="msg tool">
              <b>{it.name === "error" ? "⚠️" : "🔧 " + it.name}</b> {it.args}
            </div>
          )
          : (
            <div key={i} class="shot">
              <img src={it.src} />
            </div>
          )
      )}
    </Fragment>
  );
}

export function renderLog(items: Item[]): string {
  return renderSSR(<Log items={items} />);
}

export function renderPage(meta: string): string {
  function Page() {
    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Handsfree</title>
          <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        </head>
        <body>
          <div class="app">
            <header>
              <span id="dot" class="dot" />
              Handsfree
              <small id="meta">{meta}</small>
            </header>
            <div class="log" id="log"></div>
            <form id="form">
              <textarea
                id="draft"
                placeholder="Ask, or tell it to do something on your machine…"
              />
              <button id="send" type="submit">Send</button>
            </form>
          </div>
          <script dangerouslySetInnerHTML={{ __html: BRIDGE }} />
        </body>
      </html>
    );
  }
  return "<!DOCTYPE html>" + renderSSR(<Page />);
}
