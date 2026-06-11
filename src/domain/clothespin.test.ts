import { describe, expect, it } from 'vitest'
import {
  DIMENSIONS,
  GRIP_SOCKETS,
  JAW,
  ROTATION_STEP_DEG,
  allowedAngles,
  isAllowedAngle,
  socketByIndex,
} from './clothespin'
import type { Vec3 } from '../types'

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])

describe('GRIP_SOCKETS', () => {
  it('g0–g6 の 7 点が正準順で定義されている', () => {
    expect(GRIP_SOCKETS).toHaveLength(7)
    GRIP_SOCKETS.forEach((s, i) => {
      expect(s.index).toBe(i)
      expect(s.id).toBe(`g${i}`)
    })
  })

  it('自由度: g0–g3 = roll のみ / g4,g6 = roll+pitch / g5 = pitch のみ', () => {
    for (const s of GRIP_SOCKETS) {
      const hasRoll = s.rollMaxAbsDeg > 0
      const hasPitch = s.pitchMaxAbsDeg !== null
      if (s.index <= 3) {
        expect([hasRoll, hasPitch]).toEqual([true, false])
      } else if (s.id === 'g5') {
        expect([hasRoll, hasPitch]).toEqual([false, true])
      } else {
        expect([hasRoll, hasPitch]).toEqual([true, true])
      }
    }
  })

  it('回転範囲: roll は ±90°（g5 は 0）/ pitch は ±90°', () => {
    for (const s of GRIP_SOCKETS) {
      expect(s.rollMaxAbsDeg).toBe(s.id === 'g5' ? 0 : 90)
      if (s.pitchMaxAbsDeg !== null) expect(s.pitchMaxAbsDeg).toBe(90)
    }
  })

  it('平先端の tangent は ±Y（子は親と同一平面に乗る）', () => {
    for (const s of GRIP_SOCKETS.filter((s) => s.kind === 'flat-tip')) {
      expect(Math.abs(s.tangent[1])).toBeCloseTo(1, 10)
    }
  })

  it('リング系: normal = コイル軸(+Y) / tangent = ワイヤ方向（X-Z 面内）', () => {
    // 子の幅(Y)がワイヤに沿う = 子は親と直交 = スプリング同士はねじれの位置
    for (const s of GRIP_SOCKETS.filter((s) => s.kind === 'ring-wire')) {
      expect(s.normal).toEqual([0, 1, 0])
      expect(s.tangent[1]).toBe(0)
    }
  })

  it('normal / tangent は単位ベクトルで直交している', () => {
    for (const s of [...GRIP_SOCKETS, JAW]) {
      expect(len(s.normal)).toBeCloseTo(1, 10)
      expect(len(s.tangent)).toBeCloseTo(1, 10)
      expect(dot(s.normal, s.tangent)).toBeCloseTo(0, 10)
    }
  })

  it('全接続点がバウンディングボックス内にある', () => {
    for (const s of [...GRIP_SOCKETS, JAW]) {
      const [x, y, z] = s.position
      expect(Math.abs(x)).toBeLessThanOrEqual(DIMENSIONS.length / 2 + 1)
      expect(Math.abs(y)).toBeLessThanOrEqual(DIMENSIONS.thickness / 2)
      expect(Math.abs(z)).toBeLessThanOrEqual(DIMENSIONS.height / 2 + 1)
    }
  })

  it('socketByIndex は範囲外で undefined を返す', () => {
    expect(socketByIndex(0)?.id).toBe('g0')
    expect(socketByIndex(6)?.id).toBe('g6')
    expect(socketByIndex(7)).toBeUndefined()
    expect(socketByIndex(-1)).toBeUndefined()
  })
})

describe('allowedAngles / isAllowedAngle', () => {
  it('±90° → −90…+90 の 7 値', () => {
    expect(allowedAngles(90)).toEqual([-90, -60, -30, 0, 30, 60, 90])
  })

  it('±0°（g5 の roll）→ 0 のみ', () => {
    expect(allowedAngles(0)).toEqual([0])
  })

  it('グリッドに乗らない上限は切り捨てる（±135 → ±120）', () => {
    expect(allowedAngles(135)).toEqual([-120, -90, -60, -30, 0, 30, 60, 90, 120])
  })

  it('isAllowedAngle: グリッド上かつ範囲内のみ true', () => {
    expect(isAllowedAngle(90, 90)).toBe(true)
    expect(isAllowedAngle(-90, 90)).toBe(true)
    expect(isAllowedAngle(120, 90)).toBe(false) // 範囲外
    expect(isAllowedAngle(45, 90)).toBe(false) // グリッド外
    expect(isAllowedAngle(30, 0)).toBe(false) // g5 roll は 0 のみ
    expect(isAllowedAngle(0, 0)).toBe(true)
  })

  it('量子化ステップは 30°', () => {
    expect(ROTATION_STEP_DEG).toBe(30)
  })
})
