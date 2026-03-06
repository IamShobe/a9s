import { describe, expect, it } from "vitest";
import type { Key } from "ink";
import {
  applyAdvancedInputEdit,
  decodeAltWordDirection,
  moveCursorWordLeft,
  moveCursorWordRight,
  isAltBackspaceSignal,
} from "./AdvancedTextInput.js";

function makeKey(patch: Partial<Key> = {}): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    ...patch,
  } as Key;
}

describe("AdvancedTextInput helpers", () => {
  it("moves by words left and right across spaces/punctuation", () => {
    const text = "hello, world  test";
    expect(moveCursorWordLeft(text, text.length)).toBe(14);
    expect(moveCursorWordLeft(text, 14)).toBe(7);
    expect(moveCursorWordLeft(text, 7)).toBe(0);

    expect(moveCursorWordRight(text, 0)).toBe(5);
    expect(moveCursorWordRight(text, 5)).toBe(12);
    expect(moveCursorWordRight(text, 12)).toBe(18);
  });

  it("decodes alt/meta word directions", () => {
    expect(decodeAltWordDirection("", makeKey({ meta: true, leftArrow: true }))).toBe("left");
    expect(decodeAltWordDirection("", makeKey({ meta: true, rightArrow: true }))).toBe("right");
    expect(decodeAltWordDirection("\u001bb", makeKey())).toBe("left");
    expect(decodeAltWordDirection("\u001bf", makeKey())).toBe("right");
    expect(decodeAltWordDirection("\u001b[1;3D", makeKey())).toBe("left");
    expect(decodeAltWordDirection("\u001b[1;3C", makeKey())).toBe("right");
    expect(decodeAltWordDirection("x", makeKey())).toBeNull();
  });

  it("supports insertion, deletion, and submit", () => {
    const ins = applyAdvancedInputEdit("hello", 5, "!", makeKey());
    expect(ins.value).toBe("hello!");
    expect(ins.cursor).toBe(6);

    const back = applyAdvancedInputEdit("hello", 5, "", makeKey({ backspace: true }));
    expect(back.value).toBe("hell");
    expect(back.cursor).toBe(4);

    // Note: delete key without meta is treated as backspace (deletes before cursor)
    // because some terminals report backspace as delete key
    const del = applyAdvancedInputEdit("hello", 1, "", makeKey({ delete: true }));
    expect(del.value).toBe("ello");
    expect(del.cursor).toBe(0);

    const submit = applyAdvancedInputEdit("hello", 5, "", makeKey({ return: true }));
    expect(submit.submit).toBe(true);
  });

  it("handles backspace with single character", () => {
    // Backspace after single character should delete it
    const singleCharEnd = applyAdvancedInputEdit("a", 1, "", makeKey({ backspace: true }));
    expect(singleCharEnd.value).toBe("");
    expect(singleCharEnd.cursor).toBe(0);

    // Backspace at start should do nothing
    const singleCharStart = applyAdvancedInputEdit("a", 0, "", makeKey({ backspace: true }));
    expect(singleCharStart.value).toBe("a");
    expect(singleCharStart.cursor).toBe(0);
  });

  it("treats raw terminal backspace/delete sequences as editing signals", () => {
    const bsAscii = applyAdvancedInputEdit("hello", 5, "\u007f", makeKey());
    expect(bsAscii.value).toBe("hell");
    expect(bsAscii.cursor).toBe(4);

    const bsCtrlH = applyAdvancedInputEdit("hello", 5, "\u0008", makeKey());
    expect(bsCtrlH.value).toBe("hell");
    expect(bsCtrlH.cursor).toBe(4);

    const delSeq = applyAdvancedInputEdit("hello", 1, "\u001b[3~", makeKey());
    expect(delSeq.value).toBe("hllo");
    expect(delSeq.cursor).toBe(1);
  });

  it("does not insert control/escape sequences as text", () => {
    const escSeq = applyAdvancedInputEdit("hello", 5, "\u001b[A", makeKey());
    expect(escSeq.value).toBe("hello");
    expect(escSeq.handled).toBe(false);
  });

  it("supports word jump edit flow via meta and fallback escape sequence", () => {
    const leftMeta = applyAdvancedInputEdit("foo bar baz", 11, "", makeKey({ meta: true, leftArrow: true }));
    expect(leftMeta.cursor).toBe(8);

    const leftSeq = applyAdvancedInputEdit("foo bar baz", 8, "\u001bb", makeKey());
    expect(leftSeq.cursor).toBe(4);

    const rightMeta = applyAdvancedInputEdit("foo bar baz", 4, "", makeKey({ meta: true, rightArrow: true }));
    expect(rightMeta.cursor).toBe(7);

    const rightSeq = applyAdvancedInputEdit("foo bar baz", 7, "\u001bf", makeKey());
    expect(rightSeq.cursor).toBe(11);
  });

  it("detects alt/option+backspace signals", () => {
    // Via key object
    expect(isAltBackspaceSignal("", makeKey({ meta: true, backspace: true }))).toBe(true);
    // Via escape sequences (various terminals)
    expect(isAltBackspaceSignal("\u001b\u007f", makeKey())).toBe(true);  // ESC + DEL
    expect(isAltBackspaceSignal("\u001b\u0008", makeKey())).toBe(true);  // ESC + Backspace
    expect(isAltBackspaceSignal("\u001b[3;3~", makeKey())).toBe(true);   // Alt+Delete variant
    // Non-matches
    expect(isAltBackspaceSignal("", makeKey({ backspace: true }))).toBe(false);
    expect(isAltBackspaceSignal("x", makeKey())).toBe(false);
  });

  it("deletes whole word before cursor with alt+backspace", () => {
    // Delete "baz" when cursor is at position 11 (end of "foo bar baz")
    const deleteEnd = applyAdvancedInputEdit("foo bar baz", 11, "", makeKey({ meta: true, backspace: true }));
    expect(deleteEnd.value).toBe("foo bar ");
    expect(deleteEnd.cursor).toBe(8);

    // Delete "bar" when cursor is at position 7 (the space after "bar")
    // moveCursorWordLeft("foo bar baz", 7) returns 4, so we delete from 4 to 7
    // slice(0, 4) = "foo " + slice(7) = " baz" = "foo  baz"
    const deleteMiddle = applyAdvancedInputEdit("foo bar baz", 7, "", makeKey({ meta: true, backspace: true }));
    expect(deleteMiddle.value).toBe("foo  baz");
    expect(deleteMiddle.cursor).toBe(4);

    // Delete "foo" when cursor is at position 3 (the space after "foo")
    // moveCursorWordLeft("foo bar baz", 3) returns 0
    const deleteStart = applyAdvancedInputEdit("foo bar baz", 3, "", makeKey({ meta: true, backspace: true }));
    expect(deleteStart.value).toBe(" bar baz");
    expect(deleteStart.cursor).toBe(0);
  });

  it("handles alt+backspace with trailing/leading spaces", () => {
    // Delete "hello" when cursor is at position 5 (after "hello")
    // moveCursorWordLeft("hello   world", 5) returns 0
    // Delete from 0 to 5 removes "hello"
    const trailingSpaces = applyAdvancedInputEdit("hello   world", 5, "", makeKey({ meta: true, backspace: true }));
    expect(trailingSpaces.value).toBe("   world");
    expect(trailingSpaces.cursor).toBe(0);

    // "hello   world" at cursor 8 ('w' position)
    // moveCursorWordLeft returns 0 (goes back through 3 spaces and entire "hello")
    // So we delete from 0 to 8, leaving "world"
    const deleteSpaces = applyAdvancedInputEdit("hello   world", 8, "", makeKey({ meta: true, backspace: true }));
    expect(deleteSpaces.value).toBe("world");
    expect(deleteSpaces.cursor).toBe(0);

    // Delete "world" when cursor is at position 13 (end of string)
    // moveCursorWordLeft("hello   world", 13) returns 8 (skips back through "world" and 3 spaces to after "hello")
    const deleteWordAfterSpaces = applyAdvancedInputEdit("hello   world", 13, "", makeKey({ meta: true, backspace: true }));
    expect(deleteWordAfterSpaces.value).toBe("hello   ");
    expect(deleteWordAfterSpaces.cursor).toBe(8);
  });

  it("handles alt+backspace at start of input", () => {
    // At position 0, nothing should be deleted
    const atStart = applyAdvancedInputEdit("hello world", 0, "", makeKey({ meta: true, backspace: true }));
    expect(atStart.value).toBe("hello world");
    expect(atStart.cursor).toBe(0);
  });

  it("supports alt+backspace via escape sequences", () => {
    // Using \u001b\u007f (Alt+Backspace in some terminals)
    const escSeq1 = applyAdvancedInputEdit("foo bar baz", 11, "\u001b\u007f", makeKey());
    expect(escSeq1.value).toBe("foo bar ");
    expect(escSeq1.cursor).toBe(8);

    // Using \u001b\u0008 (Alt+Backspace in other terminals)
    const escSeq2 = applyAdvancedInputEdit("foo bar baz", 11, "\u001b\u0008", makeKey());
    expect(escSeq2.value).toBe("foo bar ");
    expect(escSeq2.cursor).toBe(8);
  });

  it("alt+backspace deletes full word even with numbers/underscores", () => {
    // "foo test_var123 bar", cursor at 14 (the '3' in '123')
    // moveCursorWordLeft at 14 returns 4 (start of "test_var123")
    // Delete from 4 to 14: slice(0,4)="foo " + slice(14)="3 bar" = "foo 3 bar"
    const wordChars = applyAdvancedInputEdit("foo test_var123 bar", 14, "", makeKey({ meta: true, backspace: true }));
    expect(wordChars.value).toBe("foo 3 bar");
    expect(wordChars.cursor).toBe(4);

    // "hello_world", cursor at 8 (the 'r')
    // moveCursorWordLeft at 8 returns 0 (entire "hello_wor" is one word)
    // Delete from 0 to 8, leaving "rld"
    const midWord = applyAdvancedInputEdit("hello_world", 8, "", makeKey({ meta: true, backspace: true }));
    expect(midWord.value).toBe("rld");
    expect(midWord.cursor).toBe(0);
  });
});
