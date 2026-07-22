import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090b',
        surface: '#111113',
        hover: '#18181b',
        border: 'rgba(255,255,255,0.07)',
        primary: '#fafafa',
        secondary: '#a1a1aa',
        accent: {
          green: '#22c55e',
          blue: '#3b82f6',
          purple: '#a78bfa',
          red: '#ef4444',
          amber: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['"Space Grotesk"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '10px',
      },
    },
  },
  plugins: [],
}

export default config
