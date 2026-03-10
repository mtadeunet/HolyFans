const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for GitHub Pages
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
  
  // Set asset prefix for GitHub Pages
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://holyfans.pt' 
    : undefined,
  
  // Disable trailing slash for GitHub Pages
  trailingSlash: false,
  
  // Ensure static export works
  distDir: 'out',
};

module.exports = withNextIntl(nextConfig);
