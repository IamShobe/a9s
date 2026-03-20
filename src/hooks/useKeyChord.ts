import { useState, useCallback } from "react";
import type { Key } from "ink";
import type { KeyBinding, KeyScope, KeyTrigger, SpecialKeyName } from "../constants/keybindings.js";
import type { KeyAction } from "../constants/keys.js";

// ---------------------------------------------------------------------------
// Pure helper: does (input, inkKey) match a single trigger?
// ---------------------------------------------------------------------------

function matchSpecial(inkKey: Key, name: SpecialKeyName): boolean {
  switch (name) {
    case "return":
      return inkKey.return;
    case "escape":
      return inkKey.escape;
    case "tab":
      return inkKey.tab;
    case "upArrow":
      return inkKey.upArrow;
    case "downArrow":
      return inkKey.downArrow;
    case "leftArrow":
      return inkKey.leftArrow;
    case "rightArrow":
      return inkKey.rightArrow;
  }
}

export function matchesTrigger(input: string, inkKey: Key, trigger: KeyTrigger): boolean {
  switch (trigger.type) {
    case "key":
      return input === trigger.char;
    case "ctrl":
      // Ctrl+A = \x01, Ctrl+B = \x02, etc.
      return input === String.fromCharCode(trigger.char.toUpperCase().charCodeAt(0) - 0x40);
    case "special":
      return matchSpecial(inkKey, trigger.name);
    case "chord":
      return false; // chords are resolved separately
    case "any":
      return trigger.of.some((t) => matchesTrigger(input, inkKey, t));
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Chord-aware key resolver.
 *
 * Usage:
 *   const { resolve } = useKeyChord(KEYBINDINGS);
 *   // inside useInput:
 *   const action = resolve(input, key, "navigate");
 *   if (action === KB.MOVE_DOWN) moveDown();
 *
 * Resolution order:
 *   1. [...pending, input] completes a chord → fire action, clear pending
 *   2. [...pending, input] is a valid chord prefix → accumulate pending, return null
 *   3. Single-key / special-key match → fire action, clear pending
 *   4. No match → clear pending, return null
 */
export function useKeyChord(bindings: KeyBinding[]) {
  const [pending, setPending] = useState<string[]>([]);

  const resolve = useCallback(
    (input: string, inkKey: Key, scope: KeyScope): KeyAction | null => {
      const scoped = bindings.filter((kb) => kb.scope === scope);
      const next = pending.length > 0 ? [...pending, input] : [input];

      // 1. Complete chord match
      const chordHit = scoped.find(
        (kb) =>
          kb.trigger.type === "chord" &&
          kb.trigger.keys.length === next.length &&
          kb.trigger.keys.every((k, i) => k === next[i]),
      );
      if (chordHit) {
        setPending([]);
        return chordHit.action;
      }

      // 2. Chord prefix — accumulate and wait for next key
      const isPrefix = scoped.some(
        (kb) =>
          kb.trigger.type === "chord" &&
          kb.trigger.keys.length > next.length &&
          kb.trigger.keys.slice(0, next.length).every((k, i) => k === next[i]),
      );
      if (isPrefix) {
        setPending(next);
        return null;
      }

      // 3. Single / special / any — only check when no chord is pending
      // (if something is pending but didn't extend any chord, fall through and
      //  reset; the current key is then checked as a fresh single-key press)
      setPending([]);
      const hit = scoped.find((kb) => matchesTrigger(input, inkKey, kb.trigger));
      return hit?.action ?? null;
    },
    [pending, bindings],
  );

  const reset = useCallback(() => setPending([]), []);

  return { pending, resolve, reset };
}
