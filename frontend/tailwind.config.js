/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        brand: {
          DEFAULT: '#0284c7', // Sky 600
          light: '#e0f2fe',
          dark: '#0369a1',
        },
        success: {
          DEFAULT: '#10b981', // Emerald 500
          light: '#d1fae5',
          dark: '#047857',
        },
        warning: {
          DEFAULT: '#f59e0b', // Amber 500
          light: '#fef3c7',
          dark: '#b45309',
        },
        danger: {
          DEFAULT: '#ef4444', // Red 500
          light: '#fee2e2',
          dark: '#b91c1c',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 8px -1px rgba(15, 23, 42, 0.03)',
        'premium-hover': '0 12px 30px -4px rgba(15, 23, 42, 0.1), 0 4px 12px -2px rgba(15, 23, 42, 0.05)',
      }
    },
  },
  plugins: [],
}
