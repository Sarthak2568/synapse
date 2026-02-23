/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0B0F14',
        card: '#121821',
        primary: '#00E5FF',
        secondary: '#00FF9D',
        warn: '#FF4D4F',
        txt: '#E6EDF3',
        subtxt: '#9BA3AF'
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      },
      borderRadius: {
        '2xl': '1.25rem'
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(0,229,255,.25), 0 0 32px rgba(0,229,255,.12)',
        card: '0 10px 30px rgba(0,0,0,.35)'
      }
    },
  },
  plugins: [],
}
