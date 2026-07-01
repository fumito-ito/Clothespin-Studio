import { describe, expect, it } from 'vitest'
import { CONNECTION_CATALOG } from './catalog'
import { GRIP_SOCKETS, isAllowedAngle, socketByIndex } from './clothespin'

describe('CONNECTION_CATALOG', () => {
  it('空でなく、全エントリが有効なソケット/角度', () => {
    expect(CONNECTION_CATALOG.length).toBeGreaterThan(0)
    for (const mv of CONNECTION_CATALOG) {
      const s = socketByIndex(mv.gripIndex)!
      expect(s).toBeDefined()
      expect(isAllowedAngle(mv.roll, s.rollMaxAbsDeg)).toBe(true)
      if (s.pitchMaxAbsDeg === null) expect(mv.pitch).toBe(0)
      else expect(isAllowedAngle(mv.pitch, s.pitchMaxAbsDeg)).toBe(true)
    }
  })

  it('全ソケットを網羅し、件数が roll×pitch の総数に一致', () => {
    const ids = new Set(CONNECTION_CATALOG.map((m) => m.gripIndex))
    expect(ids.size).toBe(GRIP_SOCKETS.length)
    // g0–g3: roll7×1, g4/g6: roll7×pitch7, g5: roll1(0のみ)×pitch7
    // = 4*7 + 2*49 + 7 = 28 + 98 + 7 = 133
    expect(CONNECTION_CATALOG.length).toBe(133)
  })
})
