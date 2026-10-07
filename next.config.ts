import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The sandbox/live-preview host changes per environment; allow all dev origins.
  allowedDevOrigins: ["*.e2b.app", "localhost"],
  images: {
    // User uploads are served from our own storage route; remote providers can
    // be added here when a storage integration (Cloudinary/S3) is configured.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    // Keep server-only modules out of client bundles.
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
