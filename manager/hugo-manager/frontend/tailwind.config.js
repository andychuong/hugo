/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Hugo website color palette - black/teal theme
        hugo: {
          // Background colors (black with teal/greenish tint matching Hugo website)
          bg: {
            primary: '#0a0e1a',      // Very dark black with slight teal tint
            secondary: '#0d1218',     // Slightly lighter dark with teal tint (header/nav)
            tertiary: '#141b26',     // Medium dark with teal tint (cards, hover)
            card: '#0f1419',         // Card background with teal tint
            hover: '#1a2332',        // Hover state with teal tint
          },
          // Text colors
          text: {
            primary: '#ffffff',      // White text
            secondary: '#d1d5db',   // Light gray text
            tertiary: '#9ca3af',    // Medium gray text
            muted: '#6b7280',        // Muted gray
          },
          // Accent colors (teal-focused theme)
          accent: {
            pink: '#ec4899',         // Pink hexagon
            blue: '#1d8ec9',         // Blue-teal mix for buttons (mix of teal and blue)
            blueLight: '#2ba3d4',    // Lighter blue-teal mix
            teal: '#14b8a6',         // Teal/green hexagon (Hugo's signature color)
            tealLight: '#2dd4bf',    // Lighter teal
            tealDark: '#0d9488',     // Darker teal
            yellow: '#f59e0b',       // Yellow/orange hexagon
          },
          // Status colors (teal/green theme)
          status: {
            success: '#14b8a6',      // Teal (Hugo's signature color)
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#14b8a6',         // Teal for info
          },
          // Border colors (teal tint)
          border: {
            default: '#1e2937',      // Dark border with teal tint
            light: '#2d3748',        // Lighter border with teal tint
            dark: '#0f1419',         // Darkest border
            teal: '#14b8a6',         // Teal border accent
          },
        },
      },
      fontFamily: {
        sans: ['Mulish', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'hugo': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'hugo-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}

