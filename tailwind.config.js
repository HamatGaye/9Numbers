/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: ["./src/app/**/*.{js,jsx,ts,tsx}", "./src/components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary action + the highlighted prefix. Blue reads as
        // deliberate and calm; red on every button read as an alarm.
        blue: {
          DEFAULT: '#2563EB',
          soft: '#60A5FA',
          deep: '#1D4ED8',
          ink: '#FFFFFF',
        },
        // Light theme: warm paper, not clinical white.
        paper: {
          DEFAULT: '#FAF7F1',
          raised: '#FFFFFF',
          sunken: '#F1ECE1',
          line: '#E6DFD1',
        },
        // Dark theme: near-black with a hint of blue, layered.
        night: {
          DEFAULT: '#0B0D11',
          raised: '#14171D',
          sunken: '#1B1F27',
          line: '#272C36',
        },
        ink: {
          DEFAULT: '#15171C',
          soft: '#5C6270',
        },
        chalk: {
          DEFAULT: '#F3F5F8',
          soft: '#8B93A1',
        },
        // Flag accents, kept for the stripe motif and semantic states.
        brand: {
          red: '#C8102E',
          blue: '#0D1D77',
          green: '#2E7D32',
        },
        good: '#3FAE7E',
        warn: '#D9982F',
        bad: '#D9534F',
        operator: {
          africell: '#E8544F',
          qcell: '#E3A83C',
          comium: '#4C8DF6',
          gamtel: '#7A828F',
          gamcel: '#3FAE7E',
        },
      },
      fontFamily: {
        // A serif display face against a sans UI is what gives the app its
        // "classic" half. Used for headlines only.
        display: ['ui-serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
