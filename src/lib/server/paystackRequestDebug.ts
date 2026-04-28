function maskSecret(value: string): string {
  if (!value) return "(empty)";
  if (value.length <= 10) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function normalizePaystackSecret(raw: string | undefined): string {
  return typeof raw === "string" ? raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, "") : "";
}

export function logPaystackAuthorizationDebug(scope: string, rawSecret: string | undefined): string {
  const trimmedSecret = normalizePaystackSecret(rawSecret);
  const authHeader = `Bearer ${trimmedSecret}`;
  const startsWithSkTest = trimmedSecret.startsWith("sk_test_");
  const startsWithSkLive = trimmedSecret.startsWith("sk_live_");

  console.log(`[paystack-auth-debug] ${scope}`, {
    keyExists: typeof rawSecret === "string",
    keyIsEmptyAfterTrim: trimmedSecret.length === 0,
    keyLength: trimmedSecret.length,
    maskedKeyPreview: trimmedSecret ? maskSecret(trimmedSecret) : "(missing)",
    keyPrefix: startsWithSkTest ? "sk_test" : startsWithSkLive ? "sk_live" : "unknown",
    authHeaderHasBearerPrefix: authHeader.startsWith("Bearer "),
  });

  return trimmedSecret;
}
