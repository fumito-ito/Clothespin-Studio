import { describe, expect, it } from 'vitest'
import { buildReliefPins, luminance, luminanceToHeight, nearestColorId } from './generator'
import { validatePins } from './graph'
import { findCollidingPins } from './collision'
import { computeBounds } from './bounds'
import { DEFAULT_PALETTE } from '../assets/palette'
import type { ReliefCell } from './generator'

const cell = (col: number, row: number, height: number, colorId = 'blue'): ReliefCell => ({
  col,
  row,
  height,
  colorId,
})

describe('buildReliefPins', () => {
  it('セルごとに height 本の連結タワーを生成し、整合性が取れている', () => {
    const pins = buildReliefPins([cell(0, 0, 4), cell(1, 0, 2), cell(0, 1, 1)])
    expect(pins).toHaveLength(7)
    expect(validatePins(pins)).toEqual([])
    // ルートは 3 本（タワー数）
    expect(pins.filter((p) => p.connection === null)).toHaveLength(3)
  })

  it('タワーは g0（上ハンドル先端）連続で伸ばす', () => {
    const pins = buildReliefPins([cell(0, 0, 5)])
    const grips = pins.filter((p) => p.connection).map((p) => p.connection!.gripIndex)
    expect(grips).toEqual([0, 0, 0, 0])
  })

  it('height 0 のセルは無視される', () => {
    expect(buildReliefPins([cell(0, 0, 0)])).toEqual([])
    expect(buildReliefPins([])).toEqual([])
  })

  it('タワーは縦に伸びる（5 段 ≈ 4×58mm + ルート）', () => {
    const pins = buildReliefPins([cell(0, 0, 5)])
    const b = computeBounds(pins)!
    expect(b.size[2]).toBeGreaterThan(200)
    expect(b.min[2]).toBeGreaterThanOrEqual(-1) // 接地（地面より下に潜らない）
  })

  it('格子は中心寄せされ、ピッチに従う', () => {
    const pins = buildReliefPins([cell(0, 0, 1), cell(2, 0, 1)], { pitchX: 65, pitchY: 20 })
    const xs = pins.map((p) => p.transform!.position[0])
    expect(Math.min(...xs)).toBeCloseTo(-65, 10)
    expect(Math.max(...xs)).toBeCloseTo(65, 10)
  })

  it('id は決定的（再生成で同一）', () => {
    const a = buildReliefPins([cell(3, 4, 2)])
    const b = buildReliefPins([cell(3, 4, 2)])
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id))
  })

  it('既定間隔で隣接タワーが干渉しない（高さバラバラの格子）', () => {
    const cells: ReliefCell[] = []
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) cells.push(cell(c, r, ((c * 3 + r) % 6) + 1))
    }
    const pins = buildReliefPins(cells)
    expect(findCollidingPins(pins).size).toBe(0)
  })
})

describe('luminance / luminanceToHeight / nearestColorId', () => {
  it('輝度は緑を最も重く評価する', () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(255, 5)
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0))
  })

  it('高さ変換: 明るいほど高く、invert で反転、最低 1 段', () => {
    expect(luminanceToHeight(255, 8, false)).toBe(8)
    expect(luminanceToHeight(0, 8, false)).toBe(1) // 0 段にはしない
    expect(luminanceToHeight(255, 8, true)).toBe(1)
    expect(luminanceToHeight(0, 8, true)).toBe(8)
  })

  it('最近傍パレット色に量子化する', () => {
    expect(nearestColorId(10, 60, 150, DEFAULT_PALETTE)).toBe('blue')
    expect(nearestColorId(250, 250, 250, DEFAULT_PALETTE)).toBe('white')
    expect(nearestColorId(170, 160, 150, DEFAULT_PALETTE)).toBe('warmgray')
  })
})
