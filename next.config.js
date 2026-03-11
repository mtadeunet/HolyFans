const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

// Check if we're in static export mode
const isStaticExport = process.env.STATIC_EXPORT === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export only when explicitly requested
  ...(isStaticExport && {
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
    assetPrefix: 'https://holyfans.pt',
    // Disable trailing slash for GitHub Pages
    trailingSlash: false,
    // Ensure static export works
    distDir: 'out',
  }),
  
  // Default configuration for development and regular production
  ...(!isStaticExport && {
    images: {
      remotePatterns: [
        {
          protocol: 'http',
          hostname: 'localhost',
        },
      ],
    },
  }),
};

module.exports = withNextIntl(nextConfig);
