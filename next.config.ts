import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit uses Node.js native modules — exclude from bundling
  serverExternalPackages: ["pdfkit"],

  // Increase body size limit for file uploads (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // pdfjs-dist tries to use canvas in Node; disable in browser bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  
  turbopack: {},
};

export default nextConfig;
