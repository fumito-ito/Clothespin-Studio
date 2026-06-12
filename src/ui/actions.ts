// UI 層のアクション（確認ダイアログ・ファイル入出力・視点操作など副作用を伴うもの）。
// コマンド本体は store / io に置く。

import { Matrix4, Vector3 } from 'three'
import { childrenByParent } from '../domain/graph'
import { buildBom } from '../domain/bom'
import { computeBounds } from '../domain/bounds'
import { parseProject, serializeProject, FILE_EXTENSION } from '../io/project'
import { bomToCsv } from '../io/exportCsv'
import { exportGlb } from '../io/exportGltf'
import { exportStl } from '../io/exportStl'
import { downloadText, timestamp } from '../io/download'
import { DEFAULT_PALETTE } from '../assets/palette'
import { useStudio } from '../state/store'
import { viewport } from '../scene/viewportHandle'

export { exportPng } from '../io/exportPng'

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

/** glTF (.glb) をダウンロード。FR-IO4 */
export function exportGlbAction() {
  void exportGlb(useStudio.getState().pins, DEFAULT_PALETTE)
}

/** STL をダウンロード。FR-IO5 */
export function exportStlAction() {
  exportStl(useStudio.getState().pins, DEFAULT_PALETTE)
}

// ---- 視点操作（FR-V3 / FR-V5） ----

export type PresetView = 'front' | 'top' | 'side' | 'iso'

/** ドメイン (Z-up) → ワールド (Y-up)。Viewport のルート回転と同一 */
const DOMAIN_TO_WORLD = new Matrix4().makeRotationX(-Math.PI / 2)

/** プリセット視点のカメラ方向（ワールド系）。top は真上特異点を避けて僅かに傾ける */
const PRESET_DIRS: Record<PresetView, Vector3> = {
  front: new Vector3(0, 0.0875, 1).normalize(), // ドメイン −Y 側から（少し見下ろす）
  top: new Vector3(0, 1, 0.02).normalize(),
  side: new Vector3(1, 0.0875, 0).normalize(),
  iso: new Vector3(1, 0.7, 1).normalize(),
}

/**
 * 構造物全体が収まるようにカメラを移動する。
 * preset 指定時はその方向から、省略時は現在の視線方向を保ってフィットする（Zoom to fit）。
 */
export function frameView(preset?: PresetView) {
  const { camera, controls } = viewport
  if (!camera || !controls) return
  const bounds = computeBounds(useStudio.getState().pins)
  const centerDomain = bounds ? new Vector3(...bounds.center) : new Vector3(0, 0, 20)
  const radius = bounds ? Math.hypot(...bounds.size) / 2 + 30 : 120
  const center = centerDomain.applyMatrix4(DOMAIN_TO_WORLD)
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.1
  const dir = preset
    ? PRESET_DIRS[preset].clone()
    : camera.position.clone().sub(controls.target).normalize()
  camera.position.copy(dir.multiplyScalar(dist).add(center))
  controls.target.copy(center)
  controls.update()
}
