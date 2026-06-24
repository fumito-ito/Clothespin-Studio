import { describe, expect, it } from 'vitest'
import { cellsToVoxels, luminance, luminanceToHeight, nearestColorId } from './generator'
import { DEFAULT_PALETTE } from '../assets/palette'
import type { ReliefCell } from './generator'

const cell = (col: number, row: number, height: number, colorId = 'blue'): ReliefCell => ({
  col,
  row,
  height,
  colorId,
})

describe('cellsToVoxels', () => {
  it('セルを高さ分のボクセルに展開し、色を引き継ぐ', () => {
    const { voxels } = cellsToVoxels([cell(0, 0, 3, 'blue'), cell(1, 0, 1, 'white')])
    expect(voxels.size).toBe(4) // 3 + 1
    expect(voxels.get('0,0,0')).toBe('blue')
    expect(voxels.get('0,0,2')).toBe('blue')
    expect(voxels.get('0,0,3')).toBeUndefined() // 高さ 3 → k=0..2
    expect(voxels.get('1,0,0')).toBe('white')
  })

  it('height 0 のセルは無視される', () => {
    const { voxels, seed } = cellsToVoxels([cell(0, 0, 0)])
    expect(voxels.size).toBe(0)
    expect(seed).toBeUndefined()
  })

  it('空入力 → 空・種なし', () => {
    expect(cellsToVoxels([])).toEqual({ voxels: new Map(), seed: undefined })
  })

  it('種は中心に最も近い充填セルの底（k=0）', () => {
    const { seed } = cellsToVoxels([cell(0, 0, 2), cell(2, 0, 2), cell(4, 0, 2)])
    expect(seed).toBe('2,0,0') // 中心列 col=2
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
