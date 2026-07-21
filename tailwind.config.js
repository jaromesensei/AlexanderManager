/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'sans-serif'],
      },
      colors: {
        // צבע מותג - אדום המבורגר של אלכסנדר
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // נייטרל חם (charcoal) - מחליף את האפור הקר של Tailwind בכל האפליקציה
        neutral: {
          50: '#faf8f6',
          100: '#f4f1ed',
          200: '#e7e2db',
          300: '#d2cabf',
          400: '#a69c8f',
          500: '#7c7367',
          600: '#5b544b',
          700: '#413b34',
          800: '#2a2621',
          900: '#1b1815',
          950: '#12100e',
        },
      },
    },
  },
  plugins: [],
}
