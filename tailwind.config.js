/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Design system "Elite Expedition" · KODA
        'bg-deep': '#0E0B08',
        'bg-surface': '#15110D',
        'bg-elevated': '#1C1712',
        'bg-line': '#2A211A',
        'ink-100': '#F5EFE6',
        'ink-80': '#D8CDBE',
        'ink-60': '#9F9486',
        'ink-40': '#6B6157',
        'ink-20': '#3D362F',
        accent: '#C8915A',
        'accent-hi': '#E0A876',
        'accent-lo': '#8A6238',
        gold: '#D4B071',
        ember: '#B5482D',
        moss: '#5C7355'
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Inter Tight"', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
}
