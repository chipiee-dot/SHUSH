import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Login + console use Inter; the sign-up page uses Plus Jakarta Sans (font-jakarta).
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        shush: {
          orange:       '#F25F13',
          orangeBright: '#F48631',
          orangeSoft:   '#F29751',
          orange600:    '#CF470C',
          orange700:    '#A63A06',
          amber:        '#F7B547',
          gold:         '#F8DE8C',
          goldSoft:     '#FCEBB5',
          cream:        '#FFF7E8',
          creamDeep:    '#FDEBCB',
          cloud:        '#EEF3F8',
          cloudShade:   '#C9D7E4',
          white:        '#FFFFFF',
          ink:          '#2A1A12',
          inkSoft:      '#6B4A3A',
          muted:        '#8A6A57',
          line:         '#F3DFC6',
          lineStrong:   '#E8C9A2',
          danger:       '#B42318',
          dangerSoft:   '#FFE1D6',
          success:      '#7A5A00',
          successSoft:  '#FDF3C9',
        },
      },
    },
  },
  plugins: [forms, containerQueries],
};
