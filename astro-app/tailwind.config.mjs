/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'geist': {
          '0': '#000000',
          '100': '#111111',
          '200': '#333333',
          '300': '#444444',
          '400': '#666666',
          '500': '#888888',
          '600': '#999999',
          '700': '#eaeaea',
          '800': '#fafafa',
          '900': '#ffffff',
        },
        'accents': {
          '1': '#fafafa',
          '2': '#eaeaea',
          '3': '#999999',
          '4': '#888888',
          '5': '#666666',
          '6': '#444444',
          '7': '#333333',
          '8': '#111111',
        },
        'error': '#e00',
        'success': '#0070f3',
        'warning': '#f5a623',
      },
      fontFamily: {
        'sans': ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        'mono': ['Geist Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        '13': '13px',
        '14': '14px',
      },
      borderRadius: {
        'vercel': '5px',
      }
    }
  },
  plugins: [],
};
