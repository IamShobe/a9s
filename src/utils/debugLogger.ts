import { appendFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const LOG_DIR = join(homedir(), '.local/share/a9s');
const LOG_FILE = join(LOG_DIR, 'debug.log');

// Ensure log directory exists
try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  // Silently fail if we can't create directory
}

function timestamp(): string {
  return new Date().toISOString();
}

export function debugLog(tag: string, message: string, data?: unknown): void {
  const logEntry = data
    ? `[${timestamp()}] ${tag} ${message} ${JSON.stringify(data)}`
    : `[${timestamp()}] ${tag} ${message}`;

  try {
    appendFileSync(LOG_FILE, logEntry + '\n');
  } catch (err) {
    // Silently fail if we can't write to log file
  }
}

export function clearDebugLog(): void {
  try {
    appendFileSync(LOG_FILE, '\n\n=== LOG CLEARED ===\n\n');
  } catch (err) {
    // Silently fail
  }
}
