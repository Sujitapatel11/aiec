/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f6fa',
          100: '#dce9f2',
          200: '#b9d3e6',
          300: '#8bb6d4',
          400: '#5592be',
          500: '#13456c',
          600: '#0c3b5e', // AIEC Logo Primary Navy
          700: '#0a314d',
          800: '#08253d',
          900: '#05192b',
        },
        crimson: {
          50: '#fdf2f2',
          100: '#fde4e4',
          200: '#fbcbcb',
          300: '#f7a3a3',
          400: '#f16e6e',
          500: '#e02833',
          600: '#d9232d', // AIEC Logo Swoosh & Red Text
          700: '#b51922',
          800: '#96181f',
          900: '#7c1a1f',
        },
        primary: {
          50: '#f0f6fa',
          100: '#dce9f2',
          500: '#13456c',
          600: '#0c3b5e',
          700: '#0a314d',
          800: '#08253d',
          900: '#05192b',
        },
        accent: {
          400: '#f16e6e',
          500: '#d9232d',
          600: '#b51922',
        },
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
