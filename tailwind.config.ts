import type { Config } from 'tailwindcss'
import { webToolsPreset } from '@web-tools/ui/tailwind-preset'

export default {
  presets: [webToolsPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config
