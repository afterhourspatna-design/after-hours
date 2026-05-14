/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline.html",
  },
});

const nextConfig = {
  reactStrictMode: true,
  // Next 15: renamed from serverComponentsExternalPackages
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

module.exports = withPWA(nextConfig);
