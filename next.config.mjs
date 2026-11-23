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
  /**
   * Implements ADR 03-004: Model Profiles — deployed serverless
   * functions only carry traced files and `public/` assets ship to
   * the CDN instead, so every route that enumerates
   * `public/images/profiles/` needs the folders traced in. Every
   * consumer — the Admin Console's pickers included — only reads the
   * profiles root, so all four entries share the narrow glob: a few
   * committed image masters, so the trace cost is bounded.
   */
  outputFileTracingIncludes: {
    '/admin': ['./public/images/profiles/**/*'],
    '/[locale]': ['./public/images/profiles/**/*'],
    '/[locale]/u/[slug]': ['./public/images/profiles/**/*'],
    '/api/likes': ['./public/images/profiles/**/*'],
  },
};

export default withNextIntl(nextConfig);
