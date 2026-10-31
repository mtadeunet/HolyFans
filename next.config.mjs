import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    /**
     * Implements ADR 00-006: Media and Asset Pipeline - "remote image
     * sources, if ever needed, are confined to an explicit allowlist —
     * never an open wildcard."
     *
     * Explicit allowlist, currently empty: all served imagery originates
     * from in-repo masters under `public/` (and committed assets), so no
     * remote image host is permitted. Add a host here only when a real
     * remote source is introduced.
     */
    remotePatterns: [],
    // Logo imagery requests quality=95 (premium brand marks); default is 75.
    qualities: [75, 95],
  },
};

export default withNextIntl(nextConfig);
