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
        kawaii: {
          pink: '#FF5C8D',
          'pink-light': '#FFE5EC',
          'pink-dark': '#D93B6E',
          gold: '#FFB800',
          'gold-light': '#FFF6D6',
          'gold-glow': '#FFD700',
          cream: '#FFFDF9',
          lavender: '#EAE6FF',
          'lavender-dark': '#231C3D',
          sky: '#E0F7FE',
          dark: '#0F0C1B',
          'dark-card': '#191428',
          'dark-border': '#2D2545',
        }
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'Outfit', 'Inter', 'system-ui', 'sans-serif'],
        lovehouse: ['Love House', 'Outfit', 'sans-serif'],
        purrfect: ['Purrfect', 'Outfit', 'sans-serif'],
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'float-slow': 'float 7s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 2s infinite',
        'sparkle': 'sparkle 1.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: 1, filter: 'drop-shadow(0 0 15px rgba(255, 92, 141, 0.6))' },
          '50%': { opacity: 0.8, filter: 'drop-shadow(0 0 5px rgba(255, 92, 141, 0.2))' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(-3%)' },
          '50%': { transform: 'translateY(0)' },
        },
        sparkle: {
          '0%, 100%': { opacity: 0.2, transform: 'scale(0.8)' },
          '50%': { opacity: 1, transform: 'scale(1.2)' },
        }
      },
      boxShadow: {
        'kawaii-pink': '0 20px 40px -15px rgba(255, 92, 141, 0.3)',
        'kawaii-gold': '0 20px 40px -15px rgba(255, 184, 0, 0.35)',
        'glass-light': '0 8px 32px 0 rgba(255, 92, 141, 0.08)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}
