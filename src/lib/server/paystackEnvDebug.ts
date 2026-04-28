interface PaystackEnvDebugInfo {
  nodeEnv: string | undefined;
  processEnvAccessible: boolean;
  envLoadedHint: boolean;
  keyExists: boolean;
  keyIsEmpty: boolean;
  keyLength: number;
  keyPrefix: "sk_test" | "sk_live" | "unknown";
  maskedKeyPreview: string;
}

function maskSecret(value: string): string {
  if (!value) return "(empty)";
  if (value.length <= 10) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function getPaystackEnvDebugInfo(): PaystackEnvDebugInfo {
  const raw = process.env.PAYSTACK_SECRET_KEY;
  const normalized = typeof raw === "string" ? raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, "") : "";
  const keyExists = typeof raw === "string";
  const keyIsEmpty = keyExists && normalized.length === 0;
  const keyPrefix = normalized.startsWith("sk_test_")
    ? "sk_test"
    : normalized.startsWith("sk_live_")
      ? "sk_live"
      : "unknown";

  return {
    nodeEnv: process.env.NODE_ENV,
    processEnvAccessible: typeof process !== "undefined" && !!process.env,
    envLoadedHint: Boolean(
      process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
    ),
    keyExists,
    keyIsEmpty,
    keyLength: normalized.length,
    keyPrefix,
    maskedKeyPreview: keyExists ? maskSecret(normalized) : "(missing)",
  };
}

export function logPaystackEnvDebug(scope: string): void {
  const info = getPaystackEnvDebugInfo();
  console.log(`[paystack-env-debug] ${scope}`, info);
  if (!info.keyExists) {
    console.warn(
      `[paystack-env-debug] ${scope}: PAYSTACK_SECRET_KEY is missing. If .env.local was edited, restart the Next.js server to reload env vars.`
    );
  } else if (info.keyIsEmpty) {
    console.warn(
      `[paystack-env-debug] ${scope}: PAYSTACK_SECRET_KEY is present but empty after trimming. Check for whitespace/quotes and restart server.`
    );
  }
}
