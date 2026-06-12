import { describe, expect, it } from 'vitest'
import { COLOR_NAME_KEYS, translate } from './messages'

describe('translate', () => {
  it('言語ごとの文言を返す', () => {
    expect(translate('ja', 'detach')).toBe('切り離し')
    expect(translate('en', 'detach')).toBe('Detach')
  })

  it('{var} を展開する（複数回出現も含む）', () => {
    expect(translate('ja', 'pinCount', { n: 42 })).toBe('42 ピン')
    expect(translate('en', 'confirmReplace', { n: 7 })).toContain('(7 pins)')
    expect(translate('en', 'sizeLabel', { x: '1.0', y: '2.0', z: '3.0' })).toBe(
      'Size: 1.0 × 2.0 × 3.0 cm (L × T × H)',
    )
  })

  it('標準パレット全色の表示名キーがある', () => {
    for (const id of ['blue', 'white', 'warmgray']) {
      const key = COLOR_NAME_KEYS[id]
      expect(key).toBeDefined()
      expect(translate('en', key)).toBeTruthy()
    }
  })
})
