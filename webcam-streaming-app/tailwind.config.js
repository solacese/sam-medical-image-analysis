/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  theme: {
    extend: {
      colors: {
        // GE HealthCare "Compassion Purple" brand palette
        'gehc-purple': '#7B61FF',
        'gehc-purple-dark': '#5B3FD6',
        'gehc-purple-deep': '#3B2A8C',
        'gehc-purple-light': '#A594FF',
        'gehc-navy': '#1F2A44',
        'gehc-ink': '#12152B',
        'gehc-bg': '#F4F2FF',
      },
      fontFamily: {
        'display': ['Poppins', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: []
};
