import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cover art comes from Jamendo's CDN and from our own R2 bucket. R2 hosts
    // are added at runtime via R2_PUBLIC_BASE_URL, so allow any https host for
    // the two CDNs we actually link to and nothing else.
    remotePatterns: [
      { protocol: "https", hostname: "**.jamendo.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
    qualities: [60, 75, 90],
  },
  // The AWS SDK ships CJS that Turbopack should not try to bundle for the edge.
  serverExternalPackages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
};

export default nextConfig;
