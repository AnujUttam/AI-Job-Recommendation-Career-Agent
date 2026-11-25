/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        navy: {
          50: '#f0f4fa',
          100: '#dce5f2',
          700: '#1e325c',
          800: '#142344',
          900: '#0b1528',
          950: '#070e1c',
        },
      },
    },
  },
  plugins: [],
};
