/** @type {import('tailwindcss').Config} */

// עוזר: בונה סקאלת צבע ממשתני CSS (תומך בשקיפות של Tailwind).
function scale(name) {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
  return Object.fromEntries(
    steps.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`])
  )
}

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'sans-serif'],
      },
      colors: {
        // צבע מותג - אינדיגו (זהות B2B). קבוע בשני המצבים.
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // משטחים וסמנטיקה - מתחלפים בין בהיר/כהה דרך טוקנים
        neutral: scale('n'),
        red: scale('rd'),
        amber: scale('am'),
        green: scale('gr'),
      },
    },
  },
  plugins: [],
}
