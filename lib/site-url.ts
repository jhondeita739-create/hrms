import "server-only";

function normalizedUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.origin;
  } catch {
    return null;
  }
}

export function getApplicationSiteUrl() {
  const configured = normalizedUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const vercel = normalizedUrl(
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL,
  );

  if (process.env.VERCEL === "1" && configured?.includes("localhost")) {
    return vercel || configured;
  }

  return configured || vercel || "http://localhost:3000";
}
