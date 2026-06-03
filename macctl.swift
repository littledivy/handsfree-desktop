// macctl — tiny CGEvent-based macOS input/control helper.
// Build: swiftc -O macctl.swift -o macctl
// Needs Accessibility permission for the controlling process (terminal/app).
import Cocoa
import CoreGraphics

let src = CGEventSource(stateID: .hidSystemState)

func sleepMs(_ ms: UInt32) { usleep(ms * 1000) }

// Logical screen size in points (matches downscaled screenshots).
func screenSize() -> (Int, Int) {
  guard let s = NSScreen.main else { return (0, 0) }
  let f = s.frame
  return (Int(f.width), Int(f.height))
}

func moveMouse(_ x: Double, _ y: Double) {
  CGEvent(mouseEventSource: src, mouseType: .mouseMoved,
          mouseCursorPosition: CGPoint(x: x, y: y), mouseButton: .left)?.post(tap: .cghidEventTap)
}

func clickAt(_ x: Double, _ y: Double, button: CGMouseButton, double: Bool, right: Bool) {
  let pt = CGPoint(x: x, y: y)
  let downType: CGEventType = right ? .rightMouseDown : .leftMouseDown
  let upType: CGEventType = right ? .rightMouseUp : .leftMouseUp
  moveMouse(x, y); sleepMs(20)
  func one(_ clickCount: Int64) {
    let d = CGEvent(mouseEventSource: src, mouseType: downType, mouseCursorPosition: pt, mouseButton: button)
    d?.setIntegerValueField(.mouseEventClickState, value: clickCount)
    d?.post(tap: .cghidEventTap)
    sleepMs(20)
    let u = CGEvent(mouseEventSource: src, mouseType: upType, mouseCursorPosition: pt, mouseButton: button)
    u?.setIntegerValueField(.mouseEventClickState, value: clickCount)
    u?.post(tap: .cghidEventTap)
  }
  one(1)
  if double { sleepMs(30); one(2) }
}

func scrollBy(_ dx: Int32, _ dy: Int32) {
  CGEvent(scrollWheelEvent2Source: src, units: .pixel, wheelCount: 2, wheel1: dy, wheel2: dx, wheel3: 0)?
    .post(tap: .cghidEventTap)
}

// Type arbitrary unicode text.
func typeText(_ text: String) {
  for ch in text {
    let s = String(ch)
    let down = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true)
    let up = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)
    var u16 = Array(s.utf16)
    down?.keyboardSetUnicodeString(stringLength: u16.count, unicodeString: &u16)
    up?.keyboardSetUnicodeString(stringLength: u16.count, unicodeString: &u16)
    down?.post(tap: .cghidEventTap)
    up?.post(tap: .cghidEventTap)
    sleepMs(4)
  }
}

let keymap: [String: CGKeyCode] = [
  "return": 36, "enter": 36, "tab": 48, "space": 49, "delete": 51, "backspace": 51,
  "escape": 53, "esc": 53, "left": 123, "right": 124, "down": 125, "up": 126,
  "home": 115, "end": 119, "pageup": 116, "pagedown": 121, "forwarddelete": 117,
  "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97, "f7": 98, "f8": 100,
  "f9": 101, "f10": 109, "f11": 103, "f12": 111,
  "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9,
  "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "o": 31, "u": 32,
  "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46,
  "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25, "0": 29,
]

// Press a key combo like "cmd+c", "cmd+shift+4", "return".
func pressCombo(_ combo: String) {
  let parts = combo.lowercased().split(separator: "+").map { String($0) }
  var flags: CGEventFlags = []
  var key: CGKeyCode? = nil
  for p in parts {
    switch p {
    case "cmd", "command", "meta", "super": flags.insert(.maskCommand)
    case "shift": flags.insert(.maskShift)
    case "alt", "option", "opt": flags.insert(.maskAlternate)
    case "ctrl", "control": flags.insert(.maskControl)
    case "fn": flags.insert(.maskSecondaryFn)
    default: key = keymap[p]
    }
  }
  guard let k = key else { FileHandle.standardError.write("unknown key: \(combo)\n".data(using: .utf8)!); return }
  let down = CGEvent(keyboardEventSource: src, virtualKey: k, keyDown: true)
  down?.flags = flags
  down?.post(tap: .cghidEventTap)
  sleepMs(20)
  let up = CGEvent(keyboardEventSource: src, virtualKey: k, keyDown: false)
  up?.flags = flags
  up?.post(tap: .cghidEventTap)
}

let args = Array(CommandLine.arguments.dropFirst())
guard let cmd = args.first else { print("usage: macctl <cmd> ..."); exit(1) }

switch cmd {
case "screensize":
  let (w, h) = screenSize(); print("\(w) \(h)")
case "move":
  moveMouse(Double(args[1])!, Double(args[2])!)
case "click":
  clickAt(Double(args[1])!, Double(args[2])!, button: .left, double: false, right: false)
case "doubleclick":
  clickAt(Double(args[1])!, Double(args[2])!, button: .left, double: true, right: false)
case "rightclick":
  clickAt(Double(args[1])!, Double(args[2])!, button: .right, double: false, right: true)
case "scroll":
  scrollBy(Int32(args[1])!, Int32(args[2])!)
case "type":
  typeText(args[1])
case "key":
  pressCombo(args[1])
default:
  FileHandle.standardError.write("unknown command: \(cmd)\n".data(using: .utf8)!); exit(1)
}
