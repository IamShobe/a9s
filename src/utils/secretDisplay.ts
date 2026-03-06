/**
 * Format secret values for display:
 * - Escape newlines as literal \n
 * - Optionally mask with asterisks if not revealed
 */
export function formatSecretForDisplay(value: string, reveal: boolean = false): string {
  if (!value) return "";

  // Escape newlines as literal \n
  const escaped = value.replace(/\n/g, "\\n").replace(/\r/g, "\\r");

  // Mask with asterisks if not revealed
  if (!reveal) {
    return "****";
  }

  return escaped;
}

/**
 * Truncate secret for table display (with escaping)
 * For hidden values: shows "****"
 * For revealed values:
 *   - Shows full value if fits in maxLength chars
 *   - Shows multi-line truncation if too large (2 header lines + ... + 1 footer line)
 */
export function truncateSecretForTable(value: string, reveal: boolean = false, maxLength: number = 50): string {
  if (!value) return "";

  const formatted = formatSecretForDisplay(value, reveal);

  // If hidden, always return the masked value
  if (!reveal) {
    return formatted; // "****"
  }

  // For revealed values, handle multi-line truncation
  const lines = formatted.split("\\n"); // Split by escaped newline
  if (lines.length > 3) {
    // Show 2 header lines + ... + 1 footer line
    const header = lines.slice(0, 2).join("\\n");
    const footer = lines[lines.length - 1];
    return `${header}\\n...\\n${footer}`;
  }

  // If single/few lines, apply character truncation
  if (formatted.length > maxLength) {
    return formatted.slice(0, maxLength) + "...";
  }

  return formatted;
}
