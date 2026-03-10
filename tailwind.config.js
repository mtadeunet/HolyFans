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
        /* Page Design Colors (Light & Clean) */
        primary: '#1e3a5f',      /* Deep Navy - for accents only */
        accent: '#d4af37',       /* Gold - for CTAs and highlights */
        background: '#ffffff',   /* Pure white background */
        surface: '#f8fafc',      /* Very light gray for cards */
        'text-primary': '#1a202c', /* Dark text for readability */
        'text-secondary': '#4a5568', /* Lighter text for secondary content */
        border: '#e2e8f0',       /* Light borders */

        /* T-Shirt Design Colors (Separate) */
        'tshirt-rose': '#e11d48',      /* Rose Red - for design only */
        'tshirt-blue': '#1e3a8a',      /* Deep Sea Blue - for design only */
        'tshirt-gold': '#d4af37',      /* Gold - for design only */
        'tshirt-gold-light': '#fbbf24', /* Light Gold - for design only */
      },
      fontFamily: {
        'serif': ['Playfair Display', 'Georgia', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'script': ['Dancing Script', 'cursive'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      maxWidth: {
        '8xl': '88rem',
      }
    },
  },
  plugins: [],
}
