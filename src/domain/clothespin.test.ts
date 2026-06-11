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

  it('pitch を持つのは g4 と g6 のみ', () => {
    const withPitch = GRIP_SOCKETS.filter((s) => s.pitchMaxAbsDeg !== null).map((s) => s.id)
    expect(withPitch).toEqual(['g4', 'g6'])
  })

  it('roll 物理範囲: 平先端 ±135° / 丸線リング ±90°', () => {
    for (const s of GRIP_SOCKETS) {
      expect(s.rollMaxAbsDeg).toBe(s.kind === 'flat-tip' ? 135 : 90)
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
  it('±135°（平先端）→ 実効 −120…+120 の 9 値', () => {
    const angles = allowedAngles(135)
    expect(angles).toEqual([-120, -90, -60, -30, 0, 30, 60, 90, 120])
  })

  it('±90°（丸線リング）→ 7 値', () => {
    expect(allowedAngles(90)).toHaveLength(7)
    expect(allowedAngles(90)).toContain(0)
    expect(allowedAngles(90)).toContain(-90)
    expect(allowedAngles(90)).toContain(90)
  })

  it('isAllowedAngle: グリッド上かつ範囲内のみ true', () => {
    expect(isAllowedAngle(120, 135)).toBe(true)
    expect(isAllowedAngle(-120, 135)).toBe(true)
    expect(isAllowedAngle(135, 135)).toBe(false) // 30° の倍数でない
    expect(isAllowedAngle(150, 135)).toBe(false) // 範囲外
    expect(isAllowedAngle(45, 135)).toBe(false) // グリッド外
    expect(isAllowedAngle(0, 90)).toBe(true)
  })

  it('量子化ステップは 30°', () => {
    expect(ROTATION_STEP_DEG).toBe(30)
  })
})
