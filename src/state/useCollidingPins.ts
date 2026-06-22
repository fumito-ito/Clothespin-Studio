// 干渉ピン集合の共有セレクタ。
// PinInstances（赤ハイライト）と ControlPanel（件数）の両方から使われるため、
// 「現在の pins の結果」を 1 件だけメモ化して共有する（= 二重計算・二重 solve を回避）。

import { useMemo } from 'react'
import type { Matrix4 } from 'three'
import type { Pin } from '../types'
import { findCollidingPins } from '../domain/collision'
import { useStudio } from './store'

const EMPTY: ReadonlySet<string> = new Set<string>()

// 単一エントリのメモ。共有したいのは「今の pins の結果」だけなので 1 件で十分。
// WeakMap だと undo/redo 履歴（zundo）が過去の pins 配列を強参照し続け、スナップショット
// ごとに Set が溜まる。そこで通常の Map を使い、set 前に clear して常に 1 件に保つ
// （過去の pins への参照を残さない）。
const cache = new Map<readonly Pin[], Set<string>>()

/**
 * showCollisions が有効なときのみ、干渉している全ピン id の集合を返す。
 * matrices を渡すと findCollidingPins 内部の solve を省略できる（描画側が解決済みの場合）。
 */
export function useCollidingPins(matrices?: Map<string, Matrix4>): ReadonlySet<string> {
  const pins = useStudio((s) => s.pins)
  const show = useStudio((s) => s.showCollisions)
  return useMemo(() => {
    if (!show) {
      cache.clear() // 無効時は計算結果を保持しない
      return EMPTY
    }
    const hit = cache.get(pins)
    if (hit) return hit
    const set = findCollidingPins(pins, { matrices })
    cache.clear() // 過去の pins を残さず常に 1 件
    cache.set(pins, set)
    return set
  }, [pins, show, matrices])
}
