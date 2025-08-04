/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 自定義暗色模式顏色 - 更柔和的深灰色調
        dark: {
          bg: '#1e1e1e',           // 主背景色
          'bg-secondary': '#252525', // 次要背景色（調暗）
          'bg-tertiary': '#2f2f2f',  // 第三層背景色（調暗）
          'bg-hover': '#353535',     // 懸停背景色（調暗）
          text: '#e8e8e8',         // 主文字色
          'text-secondary': '#a0a0a0', // 次要文字色（調暗）
          border: '#1a1a1a',       // 邊框色（更暗，幾乎看不見）
          'border-light': '#252525', // 淺邊框色（調暗）
        }
      },
      animation: {
        'spin-reverse': 'spin 1s linear infinite reverse',
      }
    },
  },
  plugins: [],
};