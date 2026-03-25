import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0d1117',
          850: '#1a1f27',
          800: '#161b22',
          700: '#21262d',
          600: '#30363d',
        },
        accent: {
          DEFAULT: '#58a6ff',
          hover: '#79c0ff',
        },
        success: '#3fb950',
        warning: '#d29922',
        danger: '#f85149',
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          muted: '#484f58',
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
