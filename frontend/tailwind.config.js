export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { ink: '#090f1c', panel: '#111b2c', edge: '#233147', accent: '#67e8f9' },
    fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'], mono: ['SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'] }
  } },
  plugins: []
};
