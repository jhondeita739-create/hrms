import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // The public application includes a PDF. Keep the full multipart request
      // below Vercel's 4.5 MB function payload limit.
      bodySizeLimit: "4.25mb",
    },
  },
};

export default nextConfig;
