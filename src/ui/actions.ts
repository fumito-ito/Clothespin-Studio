// UI 層のアクション（確認ダイアログ・ファイル入出力など副作用を伴うもの）。
// コマンド本体は store / io に置く。

import { childrenByParent } from '../domain/graph'
import { buildBom } from '../domain/bom'
import { parseProject, serializeProject, FILE_EXTENSION } from '../io/project'
import { bomToCsv } from '../io/exportCsv'
import { downloadText, timestamp } from '../io/download'
import { DEFAULT_PALETTE } from '../assets/palette'
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

/** プロジェクトを JSON でダウンロード。FR-IO1 */
export function saveProjectFile() {
  const { pins } = useStudio.getState()
  const project = serializeProject(pins, DEFAULT_PALETTE)
  downloadText(
    `clothespin-${timestamp()}${FILE_EXTENSION}`,
    JSON.stringify(project, null, 2),
    'application/json',
  )
}

/** プロジェクト JSON を読み込んで現在のモデルを置き換える。FR-IO2 */
export async function loadProjectFile(file: File) {
  const text = await file.text()
  const { project, errors } = parseProject(text)
  if (errors.length > 0 || !project) {
    window.alert(`読み込みに失敗しました:\n- ${errors.join('\n- ')}`)
    return
  }
  if (useStudio.getState().pins.length > 0) {
    if (
      !window.confirm(
        `現在のモデル（${useStudio.getState().pins.length} ピン）を破棄して読み込みます。よろしいですか？`,
      )
    ) {
      return
    }
  }
  useStudio.setState({ pins: project.pins, selectedPinId: null, placementMode: false })
  useStudio.temporal.getState().clear() // 読込前の履歴は持ち越さない
}

/** 部品リスト CSV をダウンロード。FR-IO3 */
export function exportBomCsv() {
  const { pins } = useStudio.getState()
  const csv = bomToCsv(buildBom(pins, DEFAULT_PALETTE))
  downloadText(`clothespin-bom-${timestamp()}.csv`, csv, 'text/csv')
}
