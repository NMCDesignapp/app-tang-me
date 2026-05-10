import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Increase body size limit for PDF file uploads
  serverExternalPackages: ['@pdf-lib/fontkit', 'pizzip', 'docxtemplater'],
  // Allow large file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
