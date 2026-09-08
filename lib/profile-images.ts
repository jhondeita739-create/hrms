import "server-only";

import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

const PROFILE_IMAGE_URL_TTL_SECONDS = 60 * 60;

/**
 * Returns temporary URLs for private employee profile images. The service-role
 * client is kept on the server and the browser only receives short-lived URLs.
 */
export async function getProfileImageUrlMap(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const urls = new Map<string, string>();
  if (!ids.length || !isAdminConfigured()) return urls;

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id,avatar_path")
    .in("id", ids);
  if (error) throw new Error(error.message);

  await Promise.all(
    (profiles || []).map(async (profile) => {
      if (!profile.avatar_path) return;
      const { data } = await admin.storage
        .from("profile-images")
        .createSignedUrl(profile.avatar_path, PROFILE_IMAGE_URL_TTL_SECONDS);
      if (data?.signedUrl) urls.set(profile.id, data.signedUrl);
    }),
  );

  return urls;
}
