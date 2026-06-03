// Windows computer-use backend via Deno FFI — no native helper binary.
//   input:  user32 SendInput / SetCursorPos
//   vision: gdi32 BitBlt + GetDIBits, PNG-encoded with fast-png
// Needs --allow-ffi (covered by -A).

import { encode as encodePng } from "fast-png";
import type { ComputerUse } from "./macos.ts";

export function createComputerUse(): ComputerUse {
  const u = Deno.dlopen(
    "user32.dll",
    {
      SendInput: { parameters: ["u32", "buffer", "i32"], result: "u32" },
      SetCursorPos: { parameters: ["i32", "i32"], result: "bool" },
      GetSystemMetrics: { parameters: ["i32"], result: "i32" },
      SetProcessDPIAware: { parameters: [], result: "bool" },
      VkKeyScanW: { parameters: ["u16"], result: "i16" },
      GetDC: { parameters: ["pointer"], result: "pointer" },
      ReleaseDC: { parameters: ["pointer", "pointer"], result: "i32" },
    } as const,
  );
  const g = Deno.dlopen(
    "gdi32.dll",
    {
      CreateCompatibleDC: { parameters: ["pointer"], result: "pointer" },
      CreateCompatibleBitmap: {
        parameters: ["pointer", "i32", "i32"],
        result: "pointer",
      },
      SelectObject: { parameters: ["pointer", "pointer"], result: "pointer" },
      BitBlt: {
        parameters: [
          "pointer",
          "i32",
          "i32",
          "i32",
          "i32",
          "pointer",
          "i32",
          "i32",
          "u32",
        ],
        result: "bool",
      },
      GetDIBits: {
        parameters: [
          "pointer",
          "pointer",
          "u32",
          "u32",
          "buffer",
          "buffer",
          "u32",
        ],
        result: "i32",
      },
      DeleteObject: { parameters: ["pointer"], result: "bool" },
      DeleteDC: { parameters: ["pointer"], result: "bool" },
    } as const,
  );

  u.symbols.SetProcessDPIAware();
  const screenW = u.symbols.GetSystemMetrics(0);
  const screenH = u.symbols.GetSystemMetrics(1);

  const send = (...inputs: Uint8Array[]) => {
    const buf = new Uint8Array(40 * inputs.length);
    inputs.forEach((b, i) => buf.set(b, i * 40));
    u.symbols.SendInput(inputs.length, buf, 40);
  };
  // INPUT struct (x64, 40 bytes): mouse variant.
  const mi = (dx: number, dy: number, data: number, flags: number) => {
    const b = new Uint8Array(40), v = new DataView(b.buffer);
    v.setUint32(0, 0, true);
    v.setInt32(8, dx, true);
    v.setInt32(12, dy, true);
    v.setUint32(16, data >>> 0, true);
    v.setUint32(20, flags >>> 0, true);
    return b;
  };
  // INPUT struct: keyboard variant.
  const ki = (vk: number, scan: number, flags: number) => {
    const b = new Uint8Array(40), v = new DataView(b.buffer);
    v.setUint32(0, 1, true);
    v.setUint16(8, vk, true);
    v.setUint16(10, scan, true);
    v.setUint32(12, flags >>> 0, true);
    return b;
  };
  const ABS = 0x8000,
    MOVE = 1,
    LD = 2,
    LU = 4,
    RD = 8,
    RU = 0x10,
    WHEEL = 0x800,
    HWHEEL = 0x1000,
    KEYUP = 2,
    UNI = 4;
  const abs = (x: number, sz: number) => Math.round(x * 65535 / sz);

  const move = (x: number, y: number) => {
    send(mi(abs(x, screenW), abs(y, screenH), 0, MOVE | ABS));
    u.symbols.SetCursorPos(x, y);
  };

  const VK: Record<string, number> = {
    return: 0x0D,
    enter: 0x0D,
    tab: 0x09,
    space: 0x20,
    escape: 0x1B,
    esc: 0x1B,
    backspace: 0x08,
    delete: 0x2E,
    up: 0x26,
    down: 0x28,
    left: 0x25,
    right: 0x27,
    home: 0x24,
    end: 0x23,
    pageup: 0x21,
    pagedown: 0x22,
  };
  const vkOf = (k: string) =>
    k in VK
      ? VK[k]
      : k.length === 1
      ? (u.symbols.VkKeyScanW(k.toUpperCase().charCodeAt(0)) & 0xff)
      : /^f\d+$/.test(k)
      ? 0x70 + (+k.slice(1)) - 1
      : 0;

  return {
    screenW,
    screenH,
    move,
    click: (x, y, opts = {}) => {
      move(x, y);
      const right = opts.right ?? false;
      const d = right ? RD : LD, up = right ? RU : LU;
      send(mi(0, 0, 0, d), mi(0, 0, 0, up));
      if (opts.double) send(mi(0, 0, 0, d), mi(0, 0, 0, up));
    },
    scroll: (dx, dy) => {
      if (dy) send(mi(0, 0, dy, WHEEL));
      if (dx) send(mi(0, 0, dx, HWHEEL));
    },
    type: (text) => {
      for (const ch of text) {
        const c = ch.charCodeAt(0);
        send(ki(0, c, UNI), ki(0, c, UNI | KEYUP));
      }
    },
    key: (combo) => {
      const mods: number[] = [];
      let key = 0;
      for (const p of combo.toLowerCase().split("+")) {
        if (p === "ctrl" || p === "control") mods.push(0x11);
        else if (p === "shift") mods.push(0x10);
        else if (p === "alt" || p === "option") mods.push(0x12);
        else if (p === "cmd" || p === "win" || p === "meta" || p === "super") {
          mods.push(0x5B);
        } else key = vkOf(p);
      }
      for (const m of mods) send(ki(m, 0, 0));
      if (key) {
        send(ki(key, 0, 0));
        send(ki(key, 0, KEYUP));
      }
      for (const m of mods.reverse()) send(ki(m, 0, KEYUP));
    },
    capturePng: () => {
      const screen = u.symbols.GetDC(null);
      const mem = g.symbols.CreateCompatibleDC(screen);
      const bmp = g.symbols.CreateCompatibleBitmap(screen, screenW, screenH);
      g.symbols.SelectObject(mem, bmp);
      g.symbols.BitBlt(mem, 0, 0, screenW, screenH, screen, 0, 0, 0x00CC0020); // SRCCOPY
      const bmi = new Uint8Array(40), bv = new DataView(bmi.buffer);
      bv.setUint32(0, 40, true);
      bv.setInt32(4, screenW, true);
      bv.setInt32(8, -screenH, true);
      bv.setUint16(12, 1, true);
      bv.setUint16(14, 32, true);
      bv.setUint32(16, 0, true);
      const bits = new Uint8Array(screenW * screenH * 4);
      g.symbols.GetDIBits(mem, bmp, 0, screenH, bits, bmi, 0);
      g.symbols.DeleteObject(bmp);
      g.symbols.DeleteDC(mem);
      u.symbols.ReleaseDC(null, screen);
      // BGRA → RGBA, force opaque alpha.
      for (let i = 0; i < bits.length; i += 4) {
        const b = bits[i];
        bits[i] = bits[i + 2];
        bits[i + 2] = b;
        bits[i + 3] = 255;
      }
      return Promise.resolve(
        encodePng({ width: screenW, height: screenH, data: bits, channels: 4 }),
      );
    },
  };
}
