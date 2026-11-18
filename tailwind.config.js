module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#121A33",
        paper: "#FFFFFF",
        mist: "#F2F4F8",
        line: "#DCE0E8",
        mute: "#5B6272",
        acc: "#2744D8",
        marker: "#FFE066",
      },
      fontFamily: {
        display: ["var(--f-display)", "system-ui", "sans-serif"],
        serif: ["var(--f-serif)", "Georgia", "serif"],
        sans: ["var(--f-display)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
