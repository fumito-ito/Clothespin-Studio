import { describe, expect, it } from 'vitest'
import { buildBom } from './bom'
import { DEFAULT_PALETTE } from '../assets/palette'
import type { Pin } from '../types'

const pin = (id: string, colorId: string): Pin => ({
  id,
  colorId,
  connection: null,
  transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
})

describe('buildBom', () => {
  it('色別に集計し、パレット順に並べる', () => {
    const bom = buildBom(
      [pin('a', 'white'), pin('b', 'blue'), pin('c', 'blue'), pin('d', 'warmgray')],
      DEFAULT_PALETTE,
    )
    expect(bom.rows.map((r) => [r.colorId, r.count])).toEqual([
      ['blue', 2],
      ['white', 1],
      ['warmgray', 1],
    ])
    expect(bom.total).toBe(4)
  })

  it('使用数 0 の色は行に含めない', () => {
    const bom = buildBom([pin('a', 'blue')], DEFAULT_PALETTE)
    expect(bom.rows).toHaveLength(1)
  })

  it('パレット外の色も末尾に集計する', () => {
    const bom = buildBom([pin('a', 'blue'), pin('b', 'unknown-color')], DEFAULT_PALETTE)
    expect(bom.rows.at(-1)?.colorId).toBe('unknown-color')
    expect(bom.total).toBe(2)
  })

  it('空のモデルは total 0', () => {
    expect(buildBom([], DEFAULT_PALETTE)).toEqual({ rows: [], total: 0 })
  })
})
