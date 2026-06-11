// 標準カラーパレット。docs/03-data-model.md / docs/05-roadmap.md で確定済み。

import type { PaletteColor } from '../types'

export const DEFAULT_PALETTE: readonly PaletteColor[] = [
  { id: 'blue', name: 'ブルー', hex: '#0C48A3' },
  { id: 'white', name: 'ホワイト', hex: '#FFFFFF' },
  { id: 'warmgray', name: 'ウォームグレー', hex: '#B1A29A' },
] as const

export const DEFAULT_COLOR_ID = DEFAULT_PALETTE[0].id

/** 金属スプリングの表示色（パレット外・固定） */
export const SPRING_COLOR = '#9aa0a6'
