import { refreshOpenAICodexToken } from "@mariozechner/pi-ai/oauth";

export interface CodexAuth {
  apiKey(): Promise<string>;
  refresh(): Promise<void>;
}

function jwtExpMs(t: string): number {
  try {
    return (JSON.parse(atob(t.split(".")[1])).exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

export function createCodexAuth(home: string): CodexAuth {
  const path = `${home}/.codex/auth.json`;
  let token = "";
  let expiry = 0;

  async function refresh(): Promise<void> {
    const cx = JSON.parse(await Deno.readTextFile(path));
    const stored = cx.tokens?.access_token ?? "";
    const storedExp = jwtExpMs(stored);
    if (stored && storedExp > Date.now() + 60_000) {
      token = stored;
      expiry = storedExp;
      return;
    }
    const rt = cx.tokens?.refresh_token;
    if (!rt) throw new Error("no usable codex token in ~/.codex/auth.json");
    const c = await refreshOpenAICodexToken(rt);
    token = c.access ?? c.access_token ?? "";
    if (!token) throw new Error("codex refresh returned empty access token");
    cx.tokens.access_token = token;
    cx.tokens.refresh_token = c.refresh ?? c.refresh_token ?? rt;
    cx.last_refresh = new Date().toISOString();
    await Deno.writeTextFile(path, JSON.stringify(cx, null, 2)).catch(() => {});
    expiry = jwtExpMs(token) || Date.now() + 50 * 60_000;
  }

  async function apiKey(): Promise<string> {
    if (!token || Date.now() > expiry - 60_000) await refresh();
    return token;
  }

  return { apiKey, refresh };
}
