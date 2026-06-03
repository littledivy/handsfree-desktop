/** @jsxImportSource https://esm.sh/preact@10.27.2 */
// Codex Desktop chat UI — Preact. Talks to the Deno runtime via BrowserWindow
// bindings in desktop mode (no web server), or SSE+fetch in the browser.
import { render } from "https://esm.sh/preact@10.27.2";
import { useEffect, useReducer, useRef, useState } from "https://esm.sh/preact@10.27.2/hooks";

// deno-lint-ignore no-explicit-any
type Any = any;

type Item =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; id: string; name: string; args: string }
  | { kind: "shot"; id: string; src: string };

type State = { items: Item[]; busy: boolean };
type Action =
  | { t: "user"; text: string }
  | { t: "assistant"; text: string }
  | { t: "tool"; id: string; name: string; args: string }
  | { t: "shot"; id: string; src: string }
  | { t: "endTurn" }
  | { t: "done" }
  | { t: "error"; text: string };

const seen = new Set<string>();

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "user":
      return { items: [...s.items, { kind: "user", text: a.text }], busy: true };
    case "assistant": {
      // update the trailing assistant bubble in place, or start one
      const items = s.items.slice();
      const last = items[items.length - 1];
      if (last?.kind === "assistant") items[items.length - 1] = { kind: "assistant", text: a.text };
      else items.push({ kind: "assistant", text: a.text });
      return { ...s, items };
    }
    case "tool":
      if (seen.has("c" + a.id)) return s;
      seen.add("c" + a.id);
      return { ...s, items: [...s.items, { kind: "tool", id: a.id, name: a.name, args: a.args }] };
    case "shot":
      if (seen.has("s" + a.id)) return s;
      seen.add("s" + a.id);
      return { ...s, items: [...s.items, { kind: "shot", id: a.id, src: a.src }] };
    case "endTurn":
      return s; // keep bubble; next assistant turn starts a fresh one via "user"/gap
    case "done":
      return { ...s, busy: false };
    case "error":
      return { items: [...s.items, { kind: "tool", id: "err" + Math.random(), name: "error", args: a.text }], busy: false };
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, { items: [], busy: false });
  const [meta, setMeta] = useState("connecting…");
  const [connected, setConnected] = useState(false);
  const sendRef = useRef<(t: string) => void>(() => {});
  const logRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  // Interpret a raw AgentEvent from the runtime into UI actions.
  function onEvent(m: Any) {
    const renderMsg = (msg: Any, freshTurn: boolean) => {
      let text = "";
      for (const b of msg?.content ?? []) {
        if (b.type === "text") text += b.text;
        else if (b.type === "toolCall" || b.type === "tool_use") {
          dispatch({
            t: "tool",
            id: String(b.id ?? b.toolCallId ?? JSON.stringify(b.arguments ?? b.input)),
            name: b.name ?? b.toolName,
            args: JSON.stringify(b.arguments ?? b.input ?? {}),
          });
        }
      }
      if (text) dispatch({ t: "assistant", text });
      if (freshTurn) {/* no-op marker */}
    };
    switch (m.type) {
      case "hello":
        setMeta(`${m.model} · ${m.screen.join("×")}`);
        break;
      case "message_start":
      case "message_update":
      case "message_end":
        if (m.message) renderMsg(m.message, false);
        break;
      case "turn_end":
        if (m.message) renderMsg(m.message, false);
        for (const r of m.toolResults ?? []) {
          for (const b of r.content ?? []) {
            if (b.type === "image" && b.data) {
              dispatch({ t: "shot", id: (r.toolCallId ?? r.id ?? "") + b.data.length, src: `data:${b.mimeType ?? "image/png"};base64,${b.data}` });
            }
          }
        }
        break;
      case "agent_end":
        dispatch({ t: "done" });
        break;
      case "error":
        dispatch({ t: "error", text: m.message });
        break;
    }
  }

  useEffect(() => {
    const w = window as Any;
    if (w.bindings) {
      // Desktop: direct RPC over BrowserWindow bindings — no web server.
      w.__ev = (s: string) => onEvent(JSON.parse(s));
      setConnected(true);
      w.bindings.hello().then((h: string) => {
        const x = JSON.parse(h);
        setMeta(`${x.model} · ${x.screen.join("×")}`);
      });
      sendRef.current = (t) => w.bindings.sendMessage(t);
    } else {
      // Browser dev: SSE + fetch.
      const es = new EventSource("/events");
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);
      es.onmessage = (e) => onEvent(JSON.parse(e.data));
      sendRef.current = (t) =>
        fetch("/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: t }) });
      return () => es.close();
    }
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.items]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    dispatch({ t: "user", text });
    setDraft("");
    sendRef.current(text);
  }

  return (
    <div class="app">
      <header>
        <span class={"dot" + (connected ? " on" : "")} />
        Codex Desktop
        <small>{meta}</small>
      </header>
      <div class="log" ref={logRef}>
        {state.items.map((it, i) =>
          it.kind === "user" ? <div key={i} class="msg user">{it.text}</div>
          : it.kind === "assistant" ? <div key={i} class="msg assistant">{it.text}</div>
          : it.kind === "tool" ? (
            <div key={i} class="msg tool">
              <b>{it.name === "error" ? "⚠️" : "🔧 " + it.name}</b> {it.args}
            </div>
          )
          : <div key={i} class="shot"><img src={it.src} /></div>
        )}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <textarea
          value={draft}
          placeholder="Ask, or tell it to do something on your Mac…"
          onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button disabled={state.busy}>Send</button>
      </form>
    </div>
  );
}

render(<App />, document.getElementById("root")!);
