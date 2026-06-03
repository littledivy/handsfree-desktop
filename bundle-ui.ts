// Bundle the Preact JSX UI (ui.tsx) into a self-contained client (ui.js).
// Run: deno task ui
import { bundle } from "jsr:@deno/emit";
const { code } = await bundle(new URL("./ui.tsx", import.meta.url), {
  compilerOptions: { jsx: "react-jsx", jsxImportSource: "https://esm.sh/preact@10.27.2" },
});
await Deno.writeTextFile(new URL("./ui.js", import.meta.url), code);
console.log("wrote ui.js", code.length, "bytes");
