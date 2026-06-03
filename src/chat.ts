export type Item =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; args: string }
  | { kind: "shot"; src: string };

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" ? v as Rec : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export class Chat {
  items: Item[] = [];
  busy = false;
  private seen = new Set<string>();

  pushUser(text: string): void {
    this.items.push({ kind: "user", text });
    this.busy = true;
  }

  apply(event: unknown): boolean {
    const e = rec(event);
    let changed = false;

    const addAssistant = (text: string) => {
      const last = this.items[this.items.length - 1];
      if (last?.kind === "assistant") last.text = text;
      else this.items.push({ kind: "assistant", text });
      changed = true;
    };

    const addMessage = (message: unknown) => {
      let text = "";
      for (const raw of arr(rec(message).content)) {
        const b = rec(raw);
        if (b.type === "text") {
          text += str(b.text);
        } else if (b.type === "toolCall" || b.type === "tool_use") {
          const id = str(b.id) || str(b.toolCallId) ||
            JSON.stringify(b.arguments ?? b.input);
          if (this.seen.has("c" + id)) continue;
          this.seen.add("c" + id);
          this.items.push({
            kind: "tool",
            name: str(b.name) || str(b.toolName),
            args: JSON.stringify(b.arguments ?? b.input ?? {}),
          });
          changed = true;
        }
      }
      if (text) addAssistant(text);
    };

    switch (str(e.type)) {
      case "message_start":
      case "message_update":
      case "message_end":
        if (e.message) addMessage(e.message);
        break;
      case "turn_end":
        if (e.message) addMessage(e.message);
        for (const result of arr(e.toolResults)) {
          const r = rec(result);
          for (const raw of arr(r.content)) {
            const b = rec(raw);
            if (b.type !== "image" || !b.data) continue;
            const id = (str(r.toolCallId) || str(r.id)) + str(b.data).length;
            if (this.seen.has("s" + id)) continue;
            this.seen.add("s" + id);
            this.items.push({
              kind: "shot",
              src: `data:${str(b.mimeType) || "image/png"};base64,${
                str(b.data)
              }`,
            });
            changed = true;
          }
        }
        break;
      case "agent_end":
        if (this.busy) {
          this.busy = false;
          changed = true;
        }
        break;
      case "error":
        this.items.push({ kind: "tool", name: "error", args: str(e.message) });
        this.busy = false;
        changed = true;
        break;
    }
    return changed;
  }
}
