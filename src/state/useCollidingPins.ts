// 干渉ピン集合の共有セレクタ。
// PinInstances（赤ハイライト）と ControlPanel（件数）の両方から使われるため、
// pins 参照をキーにした WeakMap で「1 つの pins につき 1 回だけ」計算して共有する
// （= レビュー指摘の二重計算・二重 solve を回避）。

import { useMemo } from 'react'
import type { Matrix4 } from 'three'
import type { Pin } from '../types'
import { findCollidingPins } from '../domain/collision'
import { useStudio } from './store'

const EMPTY: ReadonlySet<string> = new Set<string>()
const cache = new WeakMap<readonly Pin[], Set<string>>()

/**
 * showCollisions が有効なときのみ、干渉している全ピン id の集合を返す。
 * matrices を渡すと findCollidingPins 内部の solve を省略できる（描画側が解決済みの場合）。
 */
export function useCollidingPins(matrices?: Map<string, Matrix4>): ReadonlySet<string> {
  const pins = useStudio((s) => s.pins)
  const show = useStudio((s) => s.showCollisions)
  return useMemo(() => {
    if (!show) return EMPTY
    const hit = cache.get(pins)
    if (hit) return hit
    const set = findCollidingPins(pins, { matrices })
    cache.set(pins, set) // 古い pins 配列は GC で自動的に落ちる
    return set
  }, [pins, show, matrices])
}
