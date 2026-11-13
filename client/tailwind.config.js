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
          orange:      '#FD5004',
          orangeSoft:  '#FB6C30',
          orange600:   '#D93F00',
          orange700:   '#B83700',
          amber:       '#FBB144',
          gold:        '#F9E791',
          goldSoft:    '#FEEDA8',
          cream:       '#FFF8F0',
          creamDeep:   '#FCEEDF',
          white:       '#FFFFFF',
          ink:         '#2A1A12',
          inkSoft:     '#6B4A3A',
          muted:       '#8A6A57',
          line:        '#F0D9C6',
          lineStrong:  '#E4C3A8',
          danger:      '#B42318',
          dangerSoft:  '#FFE1D6',
          success:     '#7A5A00',
          successSoft: '#FDF3C9',
        },
      },
    },
  },
  plugins: [forms, containerQueries],
};
