/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        loona: {
          50: '#f0e6ff',
          100: '#d4b8ff',
          200: '#b78aff',
          300: '#9a5cff',
          400: '#7d2eff',
          500: '#6b1ae6',
          600: '#5514b4',
          700: '#3f0e82',
          800: '#2a0850',
          900: '#14031f',
        },
        night: {
          50: '#e8eaf0',
          100: '#c5c9d6',
          200: '#9ea4b8',
          300: '#777f9a',
          400: '#5a6384',
          500: '#3d476e',
          600: '#333c5e',
          700: '#272e4a',
          800: '#1c2137',
          900: '#0f1525',
          950: '#090c17',
        }
      }
    },
  },
  plugins: [],
}
