/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#070a0e',
          800: '#0a0e13',
          700: '#101620',
          600: '#161d28',
          500: '#1d2632',
          400: '#29333f',
        },
        teal: {
          400: '#3dd6c9',
          500: '#14b8a6',
          600: '#0d9488',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        rose: {
          400: '#fb7185',
          500: '#f43f5e',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
        body: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
