/**
 * Plain-text sanitization for user-generated strings (XSS / control-char mitigation).
 * Not a substitute for output encoding in React; tightens stored and echoed text.
 */
export function sanitizePlainText(input: string, maxLength: number): string {
  const noNulls = input.replace(/\u0000/g, "");
  const trimmed = noNulls.trim().slice(0, maxLength);
  // Remove simple HTML tag patterns and angle brackets for short fields
  return trimmed.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");
}

export function stripControlChars(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}
