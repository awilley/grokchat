import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#0f0f0f',
                secondary: '#151515',
                accent: '#1f1f1f',
                textPrimary: '#ffffff',
                textSecondary: '#a0a0a0',
                grokPurple: '#8459ff',
                grokPink: '#ff5da2',
                grokBlue: '#3b82f6',
                grokGreen: '#22d3ee'
            },
            boxShadow: {
                glow: '0 0 24px rgba(132, 89, 255, 0.35)'
            }
        }
    },
    plugins: [
        plugin(({ addUtilities }) => {
            addUtilities({
                '.backdrop-blur-glass': {
                    backdropFilter: 'blur(12px)',
                    backgroundColor: 'rgba(15, 15, 15, 0.72)'
                }
            });
        })
    ]
};

export default config;
