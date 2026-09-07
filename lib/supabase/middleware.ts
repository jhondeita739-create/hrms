import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isPublicPage =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/careers") ||
    request.nextUrl.pathname.startsWith("/auth/callback");
  if (!user && !isAuthPage && !isPublicPage) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(destination);
  }
  if (user && isAuthPage) {
    const destination =
      user.user_metadata?.account_type === "temporary_employee"
        ? "/employee/onboarding"
        : "/hr/dashboard";
    const { data: assurance } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") {
      const mfaPath =
        assurance?.nextLevel === "aal2" ? "/mfa/verify" : "/mfa/setup";
      const mfaUrl = new URL(mfaPath, request.url);
      mfaUrl.searchParams.set("next", destination);
      return NextResponse.redirect(mfaUrl);
    }
    return NextResponse.redirect(new URL(destination, request.url));
  }

  const isProtectedWorkspace =
    request.nextUrl.pathname.startsWith("/hr") ||
    request.nextUrl.pathname.startsWith("/employee");
  if (user && isProtectedWorkspace) {
    const { data: assurance } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") {
      const mfaPath =
        assurance?.nextLevel === "aal2" ? "/mfa/verify" : "/mfa/setup";
      const destination = request.nextUrl.clone();
      destination.pathname = mfaPath;
      destination.search = "";
      destination.searchParams.set(
        "next",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );
      return NextResponse.redirect(destination);
    }
  }
  return response;
}
