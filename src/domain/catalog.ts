// 連結カタログ（ルールベース生成アセンブリの「文法の語彙」, docs/07）。
// 有効な (socket, roll, pitch) の全列挙。各エントリ = 親に子を付ける 1 つの生成規則。

import { GRIP_SOCKETS, allowedAngles } from './clothespin'

export interface CatalogMove {
  /** 親の GRIP ソケット番号（g0=0 … g6=6） */
  gripIndex: number
  /** 度。30° 刻み */
  roll: number
  /** 度。30° 刻み。リング系以外は常に 0 */
  pitch: number
}

/** 全ソケット × 許容 roll × 許容 pitch の連結手。docs/02 §5.1 の制約に準拠 */
export const CONNECTION_CATALOG: readonly CatalogMove[] = (() => {
  const moves: CatalogMove[] = []
  for (const s of GRIP_SOCKETS) {
    const rolls = allowedAngles(s.rollMaxAbsDeg)
    const pitches = s.pitchMaxAbsDeg === null ? [0] : allowedAngles(s.pitchMaxAbsDeg)
    for (const roll of rolls) {
      for (const pitch of pitches) moves.push({ gripIndex: s.index, roll, pitch })
    }
  }
  return moves
})()
