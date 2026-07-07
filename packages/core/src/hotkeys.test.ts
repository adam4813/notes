import { describe, expect, it } from "vitest";
import {
  chordToCombo,
  findConflicts,
  formatCombo,
  normalizeCombo,
  resolveCommand,
  type HotkeyBinding,
  type KeyChord,
} from "./hotkeys";

const chord = (partial: Partial<KeyChord>): KeyChord => ({
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  key: "a",
  ...partial,
});

describe("normalizeCombo", () => {
  it("resolves Mod to ctrl off mac and meta on mac", () => {
    expect(normalizeCombo("Mod+P", "other")).toBe("ctrl+p");
    expect(normalizeCombo("Mod+P", "mac")).toBe("meta+p");
  });

  it("orders modifiers deterministically regardless of input order", () => {
    expect(normalizeCombo("Shift+Mod+K", "other")).toBe(normalizeCombo("Mod+Shift+K", "other"));
    expect(normalizeCombo("Shift+Mod+K", "other")).toBe("ctrl+shift+k");
  });

  it("normalizes key aliases", () => {
    expect(normalizeCombo("Mod+Enter", "other")).toBe("ctrl+enter");
    expect(normalizeCombo("Escape", "other")).toBe("escape");
  });
});

describe("chordToCombo", () => {
  it("maps a key press to a canonical combo", () => {
    expect(chordToCombo(chord({ ctrl: true, key: "P" }))).toBe("ctrl+p");
    expect(chordToCombo(chord({ meta: true, shift: true, key: "k" }))).toBe("meta+shift+k");
  });
});

describe("resolveCommand", () => {
  const bindings: HotkeyBinding[] = [
    { commandId: "palette", combo: "Mod+P" },
    { commandId: "quick-open", combo: "Mod+O" },
  ];

  it("matches a press against Mod bindings per platform", () => {
    expect(resolveCommand(bindings, chord({ ctrl: true, key: "p" }), "other")).toBe("palette");
    expect(resolveCommand(bindings, chord({ meta: true, key: "p" }), "mac")).toBe("palette");
    expect(resolveCommand(bindings, chord({ ctrl: true, key: "p" }), "mac")).toBeUndefined();
  });

  it("returns undefined when nothing matches", () => {
    expect(resolveCommand(bindings, chord({ key: "z" }), "other")).toBeUndefined();
  });
});

describe("findConflicts", () => {
  it("reports combos bound to more than one command", () => {
    const conflicts = findConflicts(
      [
        { commandId: "a", combo: "Mod+K" },
        { commandId: "b", combo: "Mod+K" },
        { commandId: "c", combo: "Mod+J" },
      ],
      "other",
    );
    expect(conflicts).toEqual({ "ctrl+k": ["a", "b"] });
  });
});

describe("formatCombo", () => {
  it("renders platform-appropriate labels", () => {
    expect(formatCombo("Mod+Shift+P", "mac")).toBe("⌘⇧P");
    expect(formatCombo("Mod+Shift+P", "other")).toBe("Ctrl+Shift+P");
  });
});
