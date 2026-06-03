/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h, renderSSR } from "nano-jsx";
import { extract, install, tx } from "@twind/core";
import presetAutoprefix from "@twind/preset-autoprefix";
import presetTailwind from "@twind/preset-tailwind";
import type { Item } from "./chat.ts";

install({ presets: [presetAutoprefix(), presetTailwind()], hash: false });

const EXTRA = `
*::-webkit-scrollbar{width:7px;height:7px}
*::-webkit-scrollbar-thumb{background:#3f3f46;border-radius:4px}
*::-webkit-scrollbar-thumb:hover{background:#52525b}
body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.serif{font-family:'Cormorant Garamond','Iowan Old Style','Apple Garamond',Georgia,serif;letter-spacing:-.01em}
`;

const MSG =
  "max-w-[85%] px-3.5 py-2 rounded-2xl leading-relaxed whitespace-pre-wrap break-words";

function Log({ items }: { items: Item[] }) {
  return (
    <Fragment>
      {items.map((it, i) =>
        it.kind === "user"
          ? (
            <div key={i} class={tx`${MSG} self-end bg-[#7c3aed] text-white`}>
              {it.text}
            </div>
          )
          : it.kind === "assistant"
          ? (
            <div
              key={i}
              class={tx`${MSG} self-start bg-[#18181b] border border-[#27272a] text-[#e4e4e7]`}
            >
              {it.text}
            </div>
          )
          : it.kind === "tool"
          ? (
            <div
              key={i}
              class={tx`self-start max-w-[85%] px-3 py-2 rounded-xl bg-[#0a0a0b] border border-[#27272a] text-[#a1a1aa] font-mono text-[11px] leading-relaxed`}
            >
              <b class={tx`text-[#a78bfa] font-semibold`}>
                {it.name === "error" ? "⚠" : it.name}
              </b>{" "}
              {it.args}
            </div>
          )
          : (
            <div key={i} class={tx`self-start max-w-[85%]`}>
              <img
                src={it.src}
                class={tx`w-full rounded-xl border border-[#27272a] block`}
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
        class={tx`h-full m-0 bg-[#0a0a0b] text-[#e4e4e7] font-sans text-[13px] leading-normal`}
      >
        <div class={tx`h-full flex flex-col`}>
          <header
            class={tx`h-[52px] shrink-0 px-5 flex items-center gap-2.5 border-b border-[#27272a]`}
          >
            <span class={tx`w-1.5 h-1.5 rounded-full bg-[#7c3aed]`} />
            <span class={tx`serif text-[17px] font-semibold text-[#fafafa]`}>
              Handsfree
            </span>
            <small
              class={tx`ml-auto font-mono text-[11px] tracking-wide text-[#71717a]`}
            >
              {meta}
            </small>
          </header>
          <div
            id="log"
            class={tx`flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3`}
          >
          </div>
          <div
            class={tx`shrink-0 p-3 flex items-end gap-2 border-t border-[#27272a]`}
          >
            <textarea
              id="draft"
              placeholder="Ask, or tell it to do something on your machine…"
              class={tx`flex-1 resize-none h-[44px] px-3.5 py-2.5 leading-snug bg-[#18181b] text-[#e4e4e7] placeholder:text-[#52525b] border border-[#27272a] rounded-xl [font:inherit] focus:outline-none focus:border-[#7c3aed]`}
            />
            <button
              id="send"
              type="button"
              class={tx`h-[44px] px-4 rounded-xl bg-[#fafafa] text-[#0a0a0b] font-medium border-0 cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-default`}
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
  return page.replace(
    "</head>",
    `<style data-twind>${css}${EXTRA}</style></head>`,
  );
}
