// winctl — Windows input + screen-capture helper (the macctl equivalent).
// Compile: csc.exe /target:winexe /out:winctl.exe /r:System.Drawing.dll /r:System.Windows.Forms.dll winctl.cs
// DPI-aware so screenshot pixels == SendInput coordinate space (physical px).
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Threading;

class WinCtl {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] pInputs, int cb);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern short VkKeyScan(char ch);

    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public InputUnion U; }
    [StructLayout(LayoutKind.Explicit)] struct InputUnion {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT {
        public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT {
        public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo;
    }
    const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
    const uint MOUSEEVENTF_MOVE = 0x0001, MOUSEEVENTF_ABSOLUTE = 0x8000;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002, MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008, MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_WHEEL = 0x0800, MOUSEEVENTF_HWHEEL = 0x1000;
    const uint KEYEVENTF_KEYUP = 0x0002, KEYEVENTF_UNICODE = 0x0004;

    static int SW, SH;

    static void Move(int x, int y) {
        // Absolute coords normalized to 0..65535 over the primary screen.
        int ax = (int)(x * 65535.0 / SW), ay = (int)(y * 65535.0 / SH);
        var inp = new INPUT { type = INPUT_MOUSE };
        inp.U.mi = new MOUSEINPUT { dx = ax, dy = ay, dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE };
        SendInput(1, new[] { inp }, Marshal.SizeOf(typeof(INPUT)));
        SetCursorPos(x, y);
    }
    static void MouseBtn(uint down, uint up) {
        foreach (var f in new[] { down, up }) {
            var inp = new INPUT { type = INPUT_MOUSE };
            inp.U.mi = new MOUSEINPUT { dwFlags = f };
            SendInput(1, new[] { inp }, Marshal.SizeOf(typeof(INPUT)));
            Thread.Sleep(20);
        }
    }
    static void Click(int x, int y, bool dbl, bool right) {
        Move(x, y); Thread.Sleep(30);
        uint d = right ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN;
        uint u = right ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP;
        MouseBtn(d, u);
        if (dbl) { Thread.Sleep(40); MouseBtn(d, u); }
    }
    static void Scroll(int dx, int dy) {
        if (dy != 0) { var i = new INPUT { type = INPUT_MOUSE }; i.U.mi = new MOUSEINPUT { mouseData = (uint)dy, dwFlags = MOUSEEVENTF_WHEEL }; SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT))); }
        if (dx != 0) { var i = new INPUT { type = INPUT_MOUSE }; i.U.mi = new MOUSEINPUT { mouseData = (uint)dx, dwFlags = MOUSEEVENTF_HWHEEL }; SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT))); }
    }
    static void KeyUnicode(char ch) {
        foreach (var f in new[] { KEYEVENTF_UNICODE, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP }) {
            var inp = new INPUT { type = INPUT_KEYBOARD };
            inp.U.ki = new KEYBDINPUT { wScan = ch, dwFlags = f };
            SendInput(1, new[] { inp }, Marshal.SizeOf(typeof(INPUT)));
        }
    }
    static void TypeText(string s) { foreach (char c in s) { KeyUnicode(c); Thread.Sleep(4); } }

    static void Vk(ushort vk, bool up) {
        var inp = new INPUT { type = INPUT_KEYBOARD };
        inp.U.ki = new KEYBDINPUT { wVk = vk, dwFlags = up ? KEYEVENTF_KEYUP : 0 };
        SendInput(1, new[] { inp }, Marshal.SizeOf(typeof(INPUT)));
    }
    static ushort NameToVk(string k) {
        switch (k) {
            case "return": case "enter": return 0x0D;
            case "tab": return 0x09; case "space": return 0x20;
            case "escape": case "esc": return 0x1B;
            case "backspace": return 0x08; case "delete": return 0x2E;
            case "up": return 0x26; case "down": return 0x28; case "left": return 0x25; case "right": return 0x27;
            case "home": return 0x24; case "end": return 0x23; case "pageup": return 0x21; case "pagedown": return 0x22;
            default:
                if (k.Length == 1) { short v = VkKeyScan(k[0]); return (ushort)(v & 0xff); }
                if (k.StartsWith("f") && k.Length <= 3) { int n; if (int.TryParse(k.Substring(1), out n)) return (ushort)(0x70 + n - 1); }
                return 0;
        }
    }
    static void Combo(string combo) {
        var parts = combo.ToLower().Split('+');
        var mods = new System.Collections.Generic.List<ushort>();
        ushort key = 0;
        foreach (var p in parts) {
            if (p == "ctrl" || p == "control") mods.Add(0x11);
            else if (p == "shift") mods.Add(0x10);
            else if (p == "alt" || p == "option" || p == "opt") mods.Add(0x12);
            else if (p == "cmd" || p == "win" || p == "super" || p == "meta") mods.Add(0x5B);
            else key = NameToVk(p);
        }
        foreach (var m in mods) Vk(m, false);
        if (key != 0) { Vk(key, false); Thread.Sleep(20); Vk(key, true); }
        mods.Reverse(); foreach (var m in mods) Vk(m, true);
    }

    static void Screenshot(string path) {
        var bmp = new Bitmap(SW, SH, PixelFormat.Format24bppRgb);
        using (var g = Graphics.FromImage(bmp)) g.CopyFromScreen(0, 0, 0, 0, new Size(SW, SH));
        bmp.Save(path, ImageFormat.Png);
        bmp.Dispose();
    }

    [STAThread]
    static int Main(string[] a) {
        SetProcessDPIAware();
        var b = Screen.PrimaryScreen.Bounds; SW = b.Width; SH = b.Height;
        if (a.Length == 0) { Console.Error.WriteLine("usage: winctl <cmd> ..."); return 1; }
        try {
            switch (a[0]) {
                case "screensize": Console.WriteLine(SW + " " + SH); break;
                case "screenshot": Screenshot(a[1]); break;
                case "move": Move(int.Parse(a[1]), int.Parse(a[2])); break;
                case "click": Click(int.Parse(a[1]), int.Parse(a[2]), false, false); break;
                case "doubleclick": Click(int.Parse(a[1]), int.Parse(a[2]), true, false); break;
                case "rightclick": Click(int.Parse(a[1]), int.Parse(a[2]), false, true); break;
                case "scroll": Scroll(int.Parse(a[1]), int.Parse(a[2])); break;
                case "type": TypeText(a[1]); break;
                case "key": Combo(a[1]); break;
                case "openurl":
                    // Whole Run-dialog sequence in one process so it stays
                    // foreground: Win+R, select-all, type URL, Enter.
                    Combo("win+r"); Thread.Sleep(800);
                    Combo("ctrl+a"); Thread.Sleep(80);
                    TypeText(a[1]); Thread.Sleep(250);
                    Vk(0x0D, false); Thread.Sleep(40); Vk(0x0D, true);
                    break;
                default: Console.Error.WriteLine("unknown: " + a[0]); return 1;
            }
        } catch (Exception e) { Console.Error.WriteLine(e.Message); return 1; }
        return 0;
    }
}
