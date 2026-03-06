#!/usr/bin/env node

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Press Alt+Backspace (or Option+Backspace on Mac) to see what it sends:");
console.log("(Press Ctrl+C to exit)\n");

process.stdin.on("data", (data) => {
  const bytes = Array.from(data);
  const charCodes = bytes.map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(" ");
  const escape = JSON.stringify(data.toString());

  console.log(`Raw bytes:    [${charCodes}]`);
  console.log(`As string:    ${escape}`);
  console.log(`Length:       ${data.length}\n`);
});

process.on("SIGINT", () => {
  console.log("\nExiting...");
  process.exit(0);
});
