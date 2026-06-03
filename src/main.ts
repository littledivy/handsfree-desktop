import { createCodexAuth } from "./codex.ts";
import { loadComputerUse } from "./computer/mod.ts";
import { createAgent } from "./agent.ts";
import { Chat } from "./chat.ts";
import { renderPage } from "./view.tsx";
import { startTransport } from "./transport.ts";

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

startTransport({ agent, chat, html });
