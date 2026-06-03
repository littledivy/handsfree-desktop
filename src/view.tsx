/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h, renderSSR } from "nano-jsx";
import { extract, install, tx } from "@twind/core";
import presetAutoprefix from "@twind/preset-autoprefix";
import presetTailwind from "@twind/preset-tailwind";
import type { Item } from "./chat.ts";

install({ presets: [presetAutoprefix(), presetTailwind()], hash: false });

const MSG =
  "max-w-[92%] px-3 py-[9px] rounded-xl whitespace-pre-wrap break-words";

function Log({ items }: { items: Item[] }) {
  return (
    <Fragment>
      {items.map((it, i) =>
        it.kind === "user"
          ? (
            <div key={i} class={tx`${MSG} self-end bg-[#4f46e5]`}>
              {it.text}
            </div>
          )
          : it.kind === "assistant"
          ? (
            <div key={i} class={tx`${MSG} self-start bg-[#1c1c28]`}>
              {it.text}
            </div>
          )
          : it.kind === "tool"
          ? (
            <div
              key={i}
              class={tx`${MSG} self-start bg-[#14141e] border border-[#2a2a3e] text-[#b9b9d0] font-mono text-xs rounded-lg`}
            >
              <b class={tx`text-[#818cf8] font-bold`}>
                {it.name === "error" ? "⚠️" : "🔧 " + it.name}
              </b>{" "}
              {it.args}
            </div>
          )
          : (
            <div key={i} class={tx`self-start max-w-[92%]`}>
              <img
                src={it.src}
                class={tx`w-full rounded-lg border border-[#2a2a3e] block`}
              />
            </div>
          )
      )}
    </Fragment>
  );
}

export function renderLog(items: Item[]): string {
  return renderSSR(<Log items={items} />);
}

function Page({ meta }: { meta: string }) {
  return (
    <html lang="en" class={tx`h-full [color-scheme:dark]`}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Handsfree</title>
      </head>
      <body
        class={tx`h-full m-0 bg-[#0d0d12] text-[#e8e8ee] font-sans text-sm leading-normal`}
      >
        <div class={tx`h-full flex flex-col`}>
          <header
            class={tx`px-[14px] py-[10px] bg-[#15151d] border-b border-[#26263a] flex items-center gap-2 font-semibold`}
          >
            <span class={tx`w-2 h-2 rounded-full bg-[#22c55e]`} />
            Handsfree
            <small class={tx`font-normal text-[#8a8aa0] ml-auto`}>{meta}</small>
          </header>
          <div
            id="log"
            class={tx`flex-1 overflow-y-auto p-[14px] flex flex-col gap-[10px]`}
          >
          </div>
          <div
            class={tx`flex gap-2 p-[10px] bg-[#15151d] border-t border-[#26263a]`}
          >
            <textarea
              id="draft"
              placeholder="Ask, or tell it to do something on your machine…"
              class={tx`flex-1 resize-none bg-[#0d0d12] text-[#e8e8ee] border border-[#2a2a3e] rounded-[10px] px-[11px] py-[9px] h-[42px] [font:inherit]`}
            />
            <button
              id="send"
              type="button"
              class={tx`bg-[#4f46e5] text-white border-0 rounded-[10px] px-4 cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-default`}
            >
              Send
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

export function renderPage(meta: string): string {
  const probe = renderLog([
    { kind: "user", text: "" },
    { kind: "assistant", text: "" },
    { kind: "tool", name: "", args: "" },
    { kind: "shot", src: "" },
  ]);
  const page = "<!DOCTYPE html>" + renderSSR(<Page meta={meta} />);
  const { css } = extract(page + probe);
  return page.replace("</head>", `<style data-twind>${css}</style></head>`);
}
