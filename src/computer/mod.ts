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
  key(combo: string): void;
  capturePng(): Promise<Uint8Array>;
}

export function loadComputerUse(): Promise<ComputerUse> {
  const mod = Deno.build.os === "windows"
    ? import("./win32.ts")
    : import("./macos.ts");
  return mod.then((m) => m.createComputerUse());
}
