import { describe, expect, it } from 'vitest'
import {
  childrenByParent,
  collectSubtree,
  occupiedSockets,
  validatePins,
  wouldCreateCycle,
} from './graph'
import type { Pin } from '../types'

const root: Pin = {
  id: 'root',
  colorId: 'blue',
  connection: null,
  transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
}
const pin = (id: string, parentId: string, gripIndex = 0, roll = 0, pitch?: number): Pin => ({
  id,
  colorId: 'blue',
  connection: { parentId, gripIndex, roll, ...(pitch !== undefined ? { pitch } : {}) },
})

describe('childrenByParent / occupiedSockets / collectSubtree', () => {
  const pins = [root, pin('a', 'root', 0), pin('b', 'root', 4), pin('c', 'a', 1)]

  it('親 → 子の索引を作る', () => {
    const map = childrenByParent(pins)
    expect(map.get('root')?.map((p) => p.id)).toEqual(['a', 'b'])
    expect(map.get('a')?.map((p) => p.id)).toEqual(['c'])
  })

  it('占有ソケットを集計する', () => {
    expect([...occupiedSockets(pins, 'root')].sort()).toEqual([0, 4])
    expect(occupiedSockets(pins, 'c').size).toBe(0)
  })

  it('サブツリー（自身 + 子孫）を収集する', () => {
    expect(collectSubtree(pins, 'a').sort()).toEqual(['a', 'c'])
    expect(collectSubtree(pins, 'root').sort()).toEqual(['a', 'b', 'c', 'root'])
  })
})

describe('wouldCreateCycle', () => {
  const pins = [root, pin('a', 'root'), pin('b', 'a', 1)]

  it('子孫への接続は閉路', () => {
    expect(wouldCreateCycle(pins, 'a', 'b')).toBe(true)
    expect(wouldCreateCycle(pins, 'root', 'b')).toBe(true)
    expect(wouldCreateCycle(pins, 'a', 'a')).toBe(true)
  })

  it('無関係なピンへの接続は閉路でない', () => {
    expect(wouldCreateCycle([...pins, root2()], 'a', 'root2')).toBe(false)
  })

  function root2(): Pin {
    return { ...root, id: 'root2' }
  }
})

describe('validatePins', () => {
  it('正常なフォレストはエラーなし', () => {
    expect(
      validatePins([
        root,
        pin('a', 'root', 0, 90),
        pin('b', 'a', 4, 30, 60),
        pin('c', 'a', 5, 0, 60), // g5 は pitch のみ可
      ]),
    ).toEqual([])
  })

  it('違反を検出する', () => {
    const cases: [Pin[], string][] = [
      [[pin('a', 'nope')], '存在しない'],
      [[root, pin('a', 'root', 99)], '範囲外'],
      [[root, pin('a', 'root', 0), pin('b', 'root', 0)], '二重占有'],
      [[{ ...root, transform: undefined }], 'transform がない'],
      [[root, pin('a', 'root', 0, 45)], '許容値でない'], // 30° グリッド外
      [[root, pin('a', 'root', 0, 120)], '許容値でない'], // 平先端の roll は ±90 まで
      [[root, pin('a', 'root', 0, 0, 30)], 'pitch を持たない'], // g0 は pitch なし
      [[root, pin('a', 'root', 4, 0, 120)], '許容値でない'], // pitch ±90 超過
      [[root, pin('a', 'root', 5, 30)], '許容値でない'], // g5 は roll 不可（pitch のみ）
      [[pin('a', 'b', 0), pin('b', 'a', 1)], '閉路'],
    ]
    for (const [pins, fragment] of cases) {
      const errors = validatePins(pins)
      expect(errors.join(' / ')).toContain(fragment)
    }
  })
})
