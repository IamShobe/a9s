#!/usr/bin/env node
/**
 * Debug tool to capture exact bytes sent by Alt+Backspace
 * Run this, then press Alt+Backspace, then Ctrl+C
 */

const fs = require("fs");

console.log("=".repeat(60));
console.log("ALT+BACKSPACE DEBUG CAPTURE");
console.log("=".repeat(60));
console.log("");
console.log("Instructions:");
console.log("1. Type some text (e.g., 'hello world')");
console.log("2. Press Alt+Backspace (or Option+Backspace on Mac)");
console.log("3. Watch the output below");
console.log("4. Press Ctrl+C to exit");
console.log("");
console.log("=".repeat(60));
console.log("");

// Make stdin raw so we can capture all input
const tty = require("tty");
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

let keyCount = 0;

process.stdin.on("data", (buffer) => {
  keyCount++;

  // Convert to hex bytes
  const bytes = Array.from(buffer)
    .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
    .join(" ");

  // Convert to decimal
  const decimal = Array.from(buffer)
    .map((b) => b.toString().padStart(3, " "))
    .join(" ");

  // Try to interpret as string
  let str = "";
  try {
    str = buffer.toString("utf8");
    // Replace non-printable chars
    str = str.replace(/[\x00-\x1f\x7f]/g, (c) => {
      const codes = {
        "\x1b": "ESC",
        "\x08": "BS",
        "\x7f": "DEL",
      };
      return codes[c] || `[0x${c.charCodeAt(0).toString(16)}]`;
    });
  } catch {
    str = "[binary data]";
  }

  console.log(`\n[KEY #${keyCount}]`);
  console.log(`  HEX:     [${bytes}]`);
  console.log(`  DECIMAL: [${decimal}]`);
  console.log(`  STRING:  "${str}"`);
  console.log(`  LENGTH:  ${buffer.length} byte(s)`);

  // Special check for Alt+Backspace patterns
  if (buffer.length > 1 || buffer[0] > 127) {
    console.log(`  ⭐ POTENTIAL ALT+BACKSPACE!`);
  }
});

process.on("SIGINT", () => {
  console.log("\n\n" + "=".repeat(60));
  console.log("Exiting. Copy the HEX output above and share it.");
  console.log("=".repeat(60));
  process.exit(0);
});

// Keep process alive
setInterval(() => {}, 1000);
