/**
 * Pure hotkey resolution logic. DOM-free: the web layer adapts a
 * `KeyboardEvent` into a {@link KeyChord} and persists bindings; this module
 * only normalizes, matches, and reports conflicts.
 */

export type Platform = "mac" | "other";

/** A platform-neutral description of a key press. */
export interface KeyChord {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  /** The physical key, e.g. "p", "Enter", "ArrowUp". */
  key: string;
}

/** A binding of a normalized combo string to a command id. */
export interface HotkeyBinding {
  commandId: string;
  /** Human-authored combo, e.g. "Mod+P", "Mod+Shift+K". Normalized on use. */
  combo: string;
}

const MODIFIER_ALIASES: Record<string, string> = {
  mod: "mod",
  cmd: "meta",
  command: "meta",
  meta: "meta",
  super: "meta",
  win: "meta",
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
};

/** Canonical order for modifiers so equal combos compare equal. */
const MODIFIER_ORDER = ["mod", "meta", "ctrl", "alt", "shift"];

function canonicalKey(key: string): string {
  if (key.length === 1) {
    return key.toLowerCase();
  }
  // Normalize a few common spellings; otherwise keep the DOM key name.
  const map: Record<string, string> = {
    esc: "escape",
    escape: "escape",
    del: "delete",
    delete: "delete",
    return: "enter",
    enter: "enter",
    space: " ",
    spacebar: " ",
    " ": " ",
  };
  const lower = key.toLowerCase();
  return map[lower] ?? lower;
}

/**
 * Normalizes an authored combo into a canonical string. On `mac`, a bare
 * `Mod` resolves to `meta` (⌘); elsewhere to `ctrl`. The result orders
 * modifiers deterministically so two spellings of the same combo match.
 */
export function normalizeCombo(combo: string, platform: Platform): string {
  const parts = combo
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return "";
  }

  const rawKey = parts[parts.length - 1];
  const modifierTokens = parts.slice(0, -1);

  const modifiers = new Set<string>();
  for (const token of modifierTokens) {
    const alias = MODIFIER_ALIASES[token.toLowerCase()];
    if (!alias) {
      continue;
    }
    if (alias === "mod") {
      modifiers.add(platform === "mac" ? "meta" : "ctrl");
    } else {
      modifiers.add(alias);
    }
  }

  const ordered = MODIFIER_ORDER.filter((mod) => modifiers.has(mod));
  return [...ordered, canonicalKey(rawKey)].join("+");
}

/** Converts a live key press into a canonical combo string. */
export function chordToCombo(chord: KeyChord): string {
  const modifiers: string[] = [];
  if (chord.meta) {
    modifiers.push("meta");
  }
  if (chord.ctrl) {
    modifiers.push("ctrl");
  }
  if (chord.alt) {
    modifiers.push("alt");
  }
  if (chord.shift) {
    modifiers.push("shift");
  }
  const ordered = MODIFIER_ORDER.filter((mod) => modifiers.includes(mod));
  return [...ordered, canonicalKey(chord.key)].join("+");
}

/** Resolves the command id bound to a key press, or `undefined`. */
export function resolveCommand(
  bindings: HotkeyBinding[],
  chord: KeyChord,
  platform: Platform,
): string | undefined {
  const target = chordToCombo(chord);
  for (const binding of bindings) {
    if (normalizeCombo(binding.combo, platform) === target) {
      return binding.commandId;
    }
  }
  return undefined;
}

/**
 * Groups command ids by any combo assigned to more than one command.
 * Empty combos are ignored.
 */
export function findConflicts(
  bindings: HotkeyBinding[],
  platform: Platform,
): Record<string, string[]> {
  const byCombo = new Map<string, string[]>();
  for (const binding of bindings) {
    const normalized = normalizeCombo(binding.combo, platform);
    if (!normalized || normalized.endsWith("+") || normalized === "") {
      continue;
    }
    const list = byCombo.get(normalized) ?? [];
    if (!list.includes(binding.commandId)) {
      list.push(binding.commandId);
    }
    byCombo.set(normalized, list);
  }
  const conflicts: Record<string, string[]> = {};
  for (const [combo, ids] of byCombo) {
    if (ids.length > 1) {
      conflicts[combo] = ids;
    }
  }
  return conflicts;
}

/** Renders a combo for display, e.g. "⌘⇧P" on mac or "Ctrl+Shift+P". */
export function formatCombo(combo: string, platform: Platform): string {
  const normalized = normalizeCombo(combo, platform);
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("+");
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);

  const displayKey = key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : capitalize(key);

  if (platform === "mac") {
    const symbols: Record<string, string> = { meta: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧" };
    return mods.map((mod) => symbols[mod] ?? mod).join("") + displayKey;
  }
  const labels: Record<string, string> = { meta: "Win", ctrl: "Ctrl", alt: "Alt", shift: "Shift" };
  return [...mods.map((mod) => labels[mod] ?? mod), displayKey].join("+");
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}
