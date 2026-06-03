import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { z } from "zod";
import { encodeBase64 } from "@std/encoding/base64";
import type { ComputerUse } from "./computer/mod.ts";

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

export function createAgent(opts: {
  computer: ComputerUse;
  getApiKey: () => Promise<string>;
  modelId: string;
}): Agent {
  const { computer, getApiKey, modelId } = opts;
  const isWin = Deno.build.os === "windows";
  const { screenW, screenH } = computer;

  const shot = async () => encodeBase64(await computer.capturePng());
  const img = (b64: string) => ({
    type: "image" as const,
    data: b64,
    mimeType: "image/png",
  });
  const txt = (s: string) => ({ type: "text" as const, text: s });
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const tools = [
    tool({
      name: "screenshot",
      description:
        `Capture the current screen. Returns a ${screenW}x${screenH} image; ` +
        `all click/move coordinates are in this pixel space (top-left origin).`,
      parameters: z.object({}),
      run: async () => ({
        content: [txt(`screen ${screenW}x${screenH}`), img(await shot())],
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
          content: [txt(`clicked ${p.x},${p.y}`), img(await shot())],
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
          content: [txt(`typed ${p.text.length} chars`), img(await shot())],
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
          content: [txt(`pressed ${p.keys}`), img(await shot())],
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
          content: [txt(`scrolled ${p.dx},${p.dy}`), img(await shot())],
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
        const cmd = isWin
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

  const system =
    `You are a Codex-like desktop agent that can SEE and CONTROL this ${
      isWin ? "Windows" : "macOS"
    } machine.

You have computer-use tools: screenshot, click, move, type, key, scroll, shell.
- ALWAYS take a screenshot first to see the screen before acting.
- Coordinates are in the screenshot's pixel space (${screenW}x${screenH}, top-left origin).
- After each action you get a fresh screenshot — verify the result before the next step.
- ${
      isWin
        ? 'Open apps via the Start menu: key "win", type the name, key "return".'
        : 'Open apps with Spotlight: key "cmd+space", type the name, key "return".'
    }
- Be careful and deliberate. Narrate what you're doing in short sentences.
- For coding questions, just answer directly without the computer unless asked to act.`;

  const agent = new Agent({ getApiKey });
  agent.setModel(getModel("openai-codex", modelId as never));
  agent.setSystemPrompt(system);
  agent.setTools(tools as never);
  return agent;
}
