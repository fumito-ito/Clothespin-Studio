import { describe, expect, it } from 'vitest'
import { computeBounds } from './bounds'
import { DIMENSIONS } from './clothespin'
import type { Pin } from '../types'

const rootAt = (id: string, x: number): Pin => ({
  id,
  colorId: 'blue',
  connection: null,
  transform: { position: [x, 0, 0], rotation: [0, 0, 0, 1] },
})

describe('computeBounds', () => {
  it('ピンが無ければ null', () => {
    expect(computeBounds([])).toBeNull()
  })

  it('1 ピンのサイズはバウンディングボックスに一致する', () => {
    const b = computeBounds([rootAt('a', 0)])!
    expect(b.size[0]).toBeCloseTo(DIMENSIONS.length, 10)
    expect(b.size[1]).toBeCloseTo(DIMENSIONS.thickness, 10)
    expect(b.size[2]).toBeCloseTo(DIMENSIONS.height, 10)
    expect(b.center).toEqual([0, 0, 0])
  })

  it('離れた 2 ピンで範囲が広がる', () => {
    const b = computeBounds([rootAt('a', 0), rootAt('b', 100)])!
    expect(b.size[0]).toBeCloseTo(DIMENSIONS.length + 100, 10)
    expect(b.center[0]).toBeCloseTo(50, 10)
  })

  it('連結ピン（g4 の真上）で高さが伸びる', () => {
    const pins: Pin[] = [
      rootAt('a', 0),
      { id: 'b', colorId: 'blue', connection: { parentId: 'a', gripIndex: 4, roll: 0 } },
    ]
    const b = computeBounds(pins)!
    // 子はリング上(z=10)から +40mm 上に原点が来る（jaw 30 + ring 10）
    expect(b.size[2]).toBeGreaterThan(DIMENSIONS.height + 30)
  })
})
