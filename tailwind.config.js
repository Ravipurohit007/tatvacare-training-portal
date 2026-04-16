/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5eefa',
          100: '#e9d8f5',
          200: '#d3b2eb',
          300: '#b87fdc',
          400: '#9e54cc',
          500: '#703b96',
          600: '#5a2e7a',
          700: '#432d85',
          800: '#33216a',
          900: '#241755',
        },
      },
    },
  },
  plugins: [],
}
