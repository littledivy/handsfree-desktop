/** @jsxImportSource preact */
import { transpile } from "@deno/emit";
import { render as renderToString } from "preact-render-to-string";

const PREACT = "https://esm.sh/preact@10.27.2";

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

async function transpileUi(): Promise<string> {
  const url = new URL("./ui.tsx", import.meta.url);
  const source = await Deno.readTextFile(url);
  const out = await transpile(url, {
    load: (spec) =>
      Promise.resolve(
        spec === url.href
          ? { kind: "module", specifier: spec, content: source }
          : { kind: "external", specifier: spec },
      ),
    compilerOptions: { jsx: "react-jsx", jsxImportSource: PREACT },
  });
  return out.get(url.href)!;
}

export async function renderPage(): Promise<string> {
  const ui = await transpileUi();
  const Page = () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Codex Desktop</title>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" dangerouslySetInnerHTML={{ __html: ui }} />
      </body>
    </html>
  );
  return "<!DOCTYPE html>" + renderToString(<Page />);
}
