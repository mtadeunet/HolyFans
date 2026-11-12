/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Implements ADR 03-001: Design System and Visual Identity —
           "the implemented Brand Palette as canonical": a light-theme
           scheme mirroring the feed visual language — near-white page
           wash, white card surfaces, a bright blue interactive accent
           with a deepened-blue hover/emphasis companion, near-black
           primary text, light-gray secondary text and borders. */
        primary:
          '#0369a1' /* Bright blue - CTAs, links, active/highlighted states; white text ≈5.7:1 (AA) */,
        accent:
          '#075985' /* Deepened blue - hover/emphasis companion of primary; white ≈7:1 */,
        background:
          '#fafafa' /* Near-white page wash behind the feed and rails */,
        surface: '#ffffff' /* White card surfaces */,
        'text-primary': '#111827' /* Near-black primary text */,
        'text-secondary':
          '#6b7280' /* Light-gray secondary text (captions, metadata) */,
        border: '#e5e7eb' /* Light-gray card edges and rail separators */,

        /* T-Shirt Design Colors (garment artwork only — never UI chrome) */
        'tshirt-rose': '#e11d48' /* Rose Red - for design only */,
        'tshirt-blue': '#1e3a8a' /* Deep Sea Blue - for design only */,
        'tshirt-gold': '#d4af37' /* Gold - for design only */,
        'tshirt-gold-light': '#fbbf24' /* Light Gold - for design only */,
      },
      fontFamily: {
        /* Implements ADR 03-001: "a clean, legible humanist/geometric
           sans is the default face ... a high-contrast serif display
           face is retained exclusively for the brand mark and headings
           ... No script or decorative accent face is used." */
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
};
