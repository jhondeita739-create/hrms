import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // pdf-parse loads its PDF.js worker and native canvas dependencies at
  // runtime. Keeping them external avoids Turbopack worker resolution errors
  // on Windows development and Vercel serverless functions.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  experimental: {
    serverActions: {
      // The public application includes a PDF. Keep the full multipart request
      // below Vercel's 4.5 MB function payload limit.
      bodySizeLimit: "4.25mb",
    },
  },
};

export default nextConfig;
