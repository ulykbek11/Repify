/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#FF6B00", // Orange
        secondary: "#00FF87", // Green accent
        error: "#FF3B5C", // Red error
        background: "#0A0E1A", // Dark Blue/Black background
        card: "#1A1F2E", // Slightly lighter card background
        text: "#FFFFFF", // White text
        muted: "#8B8E98", // Gray text
        surface: "#252A3B" // Input fields etc
      },
      fontFamily: {
        sans: ['System', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
