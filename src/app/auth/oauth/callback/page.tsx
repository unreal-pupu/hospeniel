import { redirect } from "next/navigation";
import { AuthCallbackClient } from "../../callback/auth-callback-client";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Google OAuth PKCE return ONLY (`signInWithOAuth` redirectTo must be this path).
 * Email/password uses `navigateAfterPasswordLogin` → role routes only; never this URL.
 *
 * Supabase Dashboard → Auth → URL configuration: allow only `{origin}/auth/oauth/callback`
 * (remove `/auth/callback` there so the IdP never sends users to the legacy path).
 */
export default function OAuthPkceCallbackPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const codeRaw = firstString(searchParams.code);
  const code = codeRaw?.trim() ?? "";
  const redirectParam = firstString(searchParams.redirect);
  const redirect_to = firstString(searchParams.redirect_to);

  if (!code) {
    redirect("/loginpage");
  }

  return (
    <AuthCallbackClient
      initialCode={code}
      redirectParamRaw={redirectParam ?? redirect_to ?? null}
    />
  );
}
