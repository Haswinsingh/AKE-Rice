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
        'forest-green': '#0a2f1d',
        'deep-green': '#1b4332',
        'emerald': '#2d6a4f',
        'accent-green': '#40916c',
        'gold': '#c5a85c',
        'gold-light': '#e2cb8f',
        'gold-dark': '#9b7e36',
        'cream': '#fbf9f4',
        'earth-brown': '#4a3b32',
        'dark-bg': '#0f1713',
        'dark-card': '#16231d',
        'dark-border': '#22382c'
      },
      fontFamily: {
        serif: ['Cinzel', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
