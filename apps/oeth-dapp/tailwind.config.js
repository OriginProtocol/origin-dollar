const { createGlobPatternsForDependencies } = require('@nrwl/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        transparent: 'transparent',
        invisible: 'rgba(1,1,1,0)',
        current: 'currentColor',
        'origin-bg-black': '#101113',
        'origin-bg-blackt': '#101113cc',
        'origin-bg-dgrey': '#141519',
        'origin-bg-dgreyt': '#141519e6',
        'origin-bg-grey': '#18191C',
        'origin-bg-greyt': '#18191Cb3',
        'origin-bg-lgrey': '#1E1F25',
        'origin-white': '#FAFBFB',
        'gradient1-from': '#B361E6',
        'gradient1-to': '#6A36FC',
        'gradient2-from': '#8C66FC',
        'gradient2-to': '#0274F1',
        'origin-dimmed': '#828699',
        'origin-border': '#141519',
        'origin-blue': '#0074f0',
        'origin-secondary': '#FFDC86',
      },
      fontFamily: {
        primary: ['Inter', 'sans-serif'],
        header: ['Sailec', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
