// UI 層のアクション（確認ダイアログなど副作用を伴うもの）。コマンド本体は store に置く。

import { childrenByParent } from '../domain/graph'
import { useStudio } from '../state/store'

/** 削除前の確認（子があるときのみ）。FR-E2 */
export function confirmAndDelete(pinId: string) {
  const { pins, deleteSubtree } = useStudio.getState()
  const childCount = childrenByParent(pins).get(pinId)?.length ?? 0
  if (childCount > 0) {
    if (!window.confirm('子ピンを含むサブツリー全体を削除します。よろしいですか？')) return
  }
  deleteSubtree(pinId)
}
