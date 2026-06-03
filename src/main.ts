import { encodeBase64 } from "@std/encoding/base64";
import { createCodexAuth } from "./codex.ts";
import { loadComputerUse } from "./computer/mod.ts";
import { createAgent } from "./agent.ts";
import { Chat } from "./chat.ts";
import { renderLog, renderPage } from "./view.tsx";

const HOME = (Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE"))!;
const MODEL_ID = Deno.env.get("CODEX_MODEL") ?? "gpt-5.4";

const codex = createCodexAuth(HOME);
await codex.refresh().catch((e) =>
  console.error(
    "codex auth deferred — run `codex login` to restore:",
    (e as Error)?.message ?? e,
  )
);
const computer = await loadComputerUse();
const agent = createAgent({
  computer,
  getApiKey: codex.apiKey,
  modelId: MODEL_ID,
});
const chat = new Chat();
const html = renderPage(
  `${MODEL_ID} · ${computer.screenW}×${computer.screenH}`,
);

const win = new Deno.BrowserWindow({
  title: "Handsfree",
  width: 480,
  height: 760,
});

// executeJs resolves to { ok, value } — unwrap the evaluated value.
const evalJs = async (code: string): Promise<unknown> =>
  ((await win.executeJs(code)) as { value?: unknown })?.value;

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
    const raw = await evalJs(
      `(() => { const d = document.getElementById("draft"); if (!d) return ""; const v = d.value; d.value = ""; return v; })()`,
    );
    const text = String(raw ?? "").trim();
    if (!text) return;
    chat.pushUser(text);
    render();
    agent.prompt(text).catch((e) => {
      if (
        chat.apply({
          type: "error",
          message: String((e as Error)?.message ?? e),
        })
      ) {
        render();
      }
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
  const hit = await evalJs(
    `document.elementFromPoint(${e.clientX}, ${e.clientY})?.id === "send"`,
  );
  if (hit === true) submit();
});

const keepAlive = setInterval(() => {}, 1 << 30);
win.addEventListener("close", () => {
  clearInterval(keepAlive);
  Deno.exit(0);
});

const page = "data:text/html;charset=utf-8;base64," +
  encodeBase64(new TextEncoder().encode(html));
win.navigate(page);
setTimeout(() => win.navigate(page), 15_500);
console.log("handsfree desktop");
