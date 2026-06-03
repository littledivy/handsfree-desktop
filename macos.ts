// macOS computer-use backend via Deno FFI — no native helper binary.
//   input:  CoreGraphics (CGEvent)
//   vision: `screencapture` + `sips` (simplest reliable path; downscale to points)
// Needs --allow-ffi / --allow-run (covered by -A).

/** Platform computer-use surface. macOS and Windows implement this with native
 * FFI; the agent in `main.tsx` talks to it and never branches on the OS. All
 * coordinates are in screen-pixel space, top-left origin. */
export interface ComputerUse {
  readonly screenW: number;
  readonly screenH: number;
  move(x: number, y: number): void;
  click(
    x: number,
    y: number,
    opts?: { double?: boolean; right?: boolean },
  ): void;
  scroll(dx: number, dy: number): void;
  type(text: string): void;
  /** Press a key or combo, e.g. "return", "cmd+space", "cmd+shift+4". */
  key(combo: string): void;
  /** PNG-encoded screenshot at screen-pixel resolution. */
  capturePng(): Promise<Uint8Array>;
}

export function createComputerUse(): ComputerUse {
  const cg = Deno.dlopen(
    "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics",
    {
      CGEventSourceCreate: { parameters: ["i32"], result: "pointer" },
      CGEventCreateMouseEvent: {
        parameters: ["pointer", "u32", { struct: ["f64", "f64"] }, "u32"],
        result: "pointer",
      },
      CGEventCreateKeyboardEvent: {
        parameters: ["pointer", "u16", "bool"],
        result: "pointer",
      },
      CGEventCreateScrollWheelEvent: {
        parameters: ["pointer", "u32", "u32", "i32", "i32"],
        result: "pointer",
      },
      CGEventPost: { parameters: ["u32", "pointer"], result: "void" },
      CGEventSetFlags: { parameters: ["pointer", "u64"], result: "void" },
      CGEventSetIntegerValueField: {
        parameters: ["pointer", "u32", "i64"],
        result: "void",
      },
      CGEventKeyboardSetUnicodeString: {
        parameters: ["pointer", "u64", "buffer"],
        result: "void",
      },
      CGMainDisplayID: { parameters: [], result: "u32" },
      CGDisplayPixelsWide: { parameters: ["u32"], result: "u64" },
      CGDisplayPixelsHigh: { parameters: ["u32"], result: "u64" },
    } as const,
  );
  const cf = Deno.dlopen(
    "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
    { CFRelease: { parameters: ["pointer"], result: "void" } } as const,
  );

  const src = cg.symbols.CGEventSourceCreate(1);
  const HID = 0;
  const pt = (x: number, y: number) =>
    new Uint8Array(new Float64Array([x, y]).buffer);
  const post = (ev: Deno.PointerValue) => {
    if (ev) {
      cg.symbols.CGEventPost(HID, ev);
      cf.symbols.CFRelease(ev);
    }
  };

  const dsp = cg.symbols.CGMainDisplayID();
  const screenW = Number(cg.symbols.CGDisplayPixelsWide(dsp));
  const screenH = Number(cg.symbols.CGDisplayPixelsHigh(dsp));

  // CGKeyCode table for the keys we name; single chars route through
  // CGEventKeyboardSetUnicodeString in `type`, so only combos need codes.
  const KC: Record<string, number> = {
    return: 36,
    enter: 36,
    tab: 48,
    space: 49,
    delete: 51,
    escape: 53,
    esc: 53,
    left: 123,
    right: 124,
    down: 125,
    up: 126,
    a: 0,
    s: 1,
    d: 2,
    f: 3,
    h: 4,
    g: 5,
    z: 6,
    x: 7,
    c: 8,
    v: 9,
    b: 11,
    q: 12,
    w: 13,
    e: 14,
    r: 15,
    y: 16,
    t: 17,
    o: 31,
    u: 32,
    i: 34,
    p: 35,
    l: 37,
    j: 38,
    k: 40,
    n: 45,
    m: 46,
    "1": 18,
    "2": 19,
    "3": 20,
    "4": 21,
    "5": 23,
    "6": 22,
    "7": 26,
    "8": 28,
    "9": 25,
    "0": 29,
  };

  return {
    screenW,
    screenH,
    move: (x, y) =>
      post(cg.symbols.CGEventCreateMouseEvent(src, 5, pt(x, y), 0)),
    click: (x, y, opts = {}) => {
      const right = opts.right ?? false;
      const btn = right ? 1 : 0, down = right ? 3 : 1, up = right ? 4 : 2;
      const one = (clickCount: number) => {
        const d = cg.symbols.CGEventCreateMouseEvent(src, down, pt(x, y), btn);
        cg.symbols.CGEventSetIntegerValueField(d, 1, BigInt(clickCount));
        post(d);
        const u = cg.symbols.CGEventCreateMouseEvent(src, up, pt(x, y), btn);
        cg.symbols.CGEventSetIntegerValueField(u, 1, BigInt(clickCount));
        post(u);
      };
      one(1);
      if (opts.double) one(2);
    },
    scroll: (dx, dy) =>
      post(cg.symbols.CGEventCreateScrollWheelEvent(src, 0, 2, dy, dx)),
    type: (text) => {
      for (const ch of text) {
        const buf = new Uint8Array(
          new Uint16Array([...ch].map((c) => c.charCodeAt(0))).buffer,
        );
        const len = BigInt(buf.byteLength / 2);
        const d = cg.symbols.CGEventCreateKeyboardEvent(src, 0, true);
        cg.symbols.CGEventKeyboardSetUnicodeString(d, len, buf);
        post(d);
        const u = cg.symbols.CGEventCreateKeyboardEvent(src, 0, false);
        cg.symbols.CGEventKeyboardSetUnicodeString(u, len, buf);
        post(u);
      }
    },
    key: (combo) => {
      let flags = 0n, key = -1;
      for (const p of combo.toLowerCase().split("+")) {
        if (p === "cmd" || p === "command" || p === "meta" || p === "super") {
          flags |= 0x100000n;
        } else if (p === "shift") flags |= 0x20000n;
        else if (p === "alt" || p === "option") flags |= 0x80000n;
        else if (p === "ctrl" || p === "control") flags |= 0x40000n;
        else if (p in KC) key = KC[p];
      }
      if (key < 0) return;
      const d = cg.symbols.CGEventCreateKeyboardEvent(src, key, true);
      cg.symbols.CGEventSetFlags(d, flags);
      post(d);
      const u = cg.symbols.CGEventCreateKeyboardEvent(src, key, false);
      cg.symbols.CGEventSetFlags(u, flags);
      post(u);
    },
    capturePng: async () => {
      const raw = await Deno.makeTempFile({ suffix: ".png" });
      const out = await Deno.makeTempFile({ suffix: ".png" });
      await new Deno.Command("screencapture", {
        args: ["-x", "-t", "png", raw],
      }).output();
      await new Deno.Command("sips", {
        args: ["-z", String(screenH), String(screenW), raw, "--out", out],
      }).output();
      const bytes = await Deno.readFile(out);
      await Deno.remove(raw).catch(() => {});
      await Deno.remove(out).catch(() => {});
      return bytes;
    },
  };
}
