import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Increase body size limit for PDF file uploads
  serverExternalPackages: ['@pdf-lib/fontkit'],
};

export default nextConfig;
