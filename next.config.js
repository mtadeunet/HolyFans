/** @type {import('next').NextConfig} */
const nextConfig = {
  // Always enable static export for GitHub Pages
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  // Set asset prefix for GitHub Pages (only in production)
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://www.holyfans.pt' : undefined,
  // Disable trailing slash for GitHub Pages
  trailingSlash: false,
  // Ensure static export works
  distDir: 'out',
};

module.exports = nextConfig;
