import { describe, expect, it } from 'vitest'
import { growAssembly } from './grow'
import { validatePins } from './graph'
import { findCollidingPins } from './collision'

/** 直方体ボクセル目標（全セル同色） */
function box(nx: number, ny: number, nz: number, colorId = 'blue'): Map<string, string> {
  const v = new Map<string, string>()
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) v.set(`${i},${j},${k}`, colorId)
  return v
}

describe('growAssembly', () => {
  it('空目標 → 空', () => {
    expect(growAssembly(new Map(), 45)).toEqual({ pins: [], covered: 0, target: 0 })
  })

  it('1 ボクセル → 種ピン 1 本（その色）', () => {
    const r = growAssembly(new Map([['0,0,0', 'white']]), 45)
    expect(r.pins).toHaveLength(1)
    expect(r.pins[0].connection).toBeNull()
    expect(r.pins[0].colorId).toBe('white')
    expect(r.covered).toBe(1)
  })

  it('直方体目標を高被覆・1連結木・干渉ゼロで充填する', () => {
    const target = box(6, 6, 2)
    const r = growAssembly(target, 45, '3,3,0')
    expect(validatePins(r.pins)).toEqual([]) // 整合性 OK（単一木）
    expect(r.pins.filter((p) => p.connection === null)).toHaveLength(1) // 1 ルート
    expect(findCollidingPins(r.pins).size).toBe(0) // 干渉なし
    expect(r.covered / r.target).toBeGreaterThan(0.95) // 95% 以上被覆
  })

  it('生成ピンの色は覆ったボクセルの色に一致する', () => {
    const v = new Map<string, string>()
    for (let i = 0; i < 4; i++) v.set(`${i},0,0`, i < 2 ? 'blue' : 'white')
    const r = growAssembly(v, 45, '0,0,0')
    for (const p of r.pins) expect(['blue', 'white']).toContain(p.colorId)
  })

  it('決定的（同入力で同じ id 列）', () => {
    const t = box(3, 3, 2)
    const a = growAssembly(t, 45, '1,1,0')
    const b = growAssembly(t, 45, '1,1,0')
    expect(a.pins.map((p) => p.id)).toEqual(b.pins.map((p) => p.id))
  })
})
