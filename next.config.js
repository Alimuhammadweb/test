/** @type {import('next').NextConfig} */
module.exports = {
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
  images: {
    // Images served from PostgreSQL via /api/media/[id] are local, so no remote hosts are needed.
    formats: ["image/webp"],
    deviceSizes: [480, 768, 1080, 1440],
    imageSizes: [160, 320, 480],
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};
