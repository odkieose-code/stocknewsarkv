/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        positive: '#10b981',
        negative: '#ef4444',
        neutral: '#6b7280',
      }
    },
  },
  plugins: [],
}
