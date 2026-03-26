/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: ['text-hl-key', 'text-hl-string', 'text-hl-number'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0c0f',
        surface: '#111318',
        surface2: '#181c23',
        border: '#1f2530',
        accent: '#00e5a0',
        accent2: '#4f8cff',
        warn: '#ffb347',
        danger: '#ff4f6a',
        muted: '#5a6070',
        text: '#e6edf3',
        editor: '#0d1117',
        hl: {
          key: '#79b8ff',
          string: '#9ecbff',
          number: '#f8c555',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
