/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        border: v('border'),
        ink: v('ink'),
        muted: v('muted'),
        navy: v('navy'),
        lavender: v('lavender'),
        'lavender-soft': v('lavender-soft'),
        sky: v('sky'),
        'sky-soft': v('sky-soft'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
        ko: ['"Noto Sans KR"', '"IBM Plex Sans Thai"', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 4px 16px rgb(var(--shadow) / 0.05)',
        lift: '0 8px 30px rgb(var(--shadow) / 0.12)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pop: { '0%': { transform: 'scale(.96)' }, '60%': { transform: 'scale(1.02)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-up': 'fade-up .25s ease-out both',
        pop: 'pop .25s ease-out',
      },
    },
  },
  plugins: [],
};
