/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: ["./src/app/**/*.{js,jsx,ts,tsx}", "./src/components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#C8102E',
          blue: '#0D1D77',
          green: '#2E7D32',
          cream: '#FAF7F2',
          ink: '#1A1D29',
        },
        operator: {
          africell: '#E11D48',
          qcell: '#D97706',
          comium: '#2563EB',
          gamtel: '#64748B',
          gamcel: '#059669',
        },
      },
    },
  },
  plugins: [],
}
