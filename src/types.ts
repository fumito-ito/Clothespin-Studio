// 共有型定義。docs/03-data-model.md §1.4 を正とする。

export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number] // x, y, z, w

export interface Transform {
  position: Vec3 // mm, world
  rotation: Quat
}

export interface Connection {
  parentId: string
  /** 親の GRIP ソケット番号 (g0=0 … g6=6) */
  gripIndex: number
  /** 度。30° 刻み。許容範囲はソケット種別で異なる（docs/02 §5.1。g5 は 0 固定） */
  roll: number
  /** 度。30° 刻み。リング系 (g4/g5/g6) のみ有効。省略時は 0 */
  pitch?: number
}

export interface Pin {
  id: string
  /** palette[].id を参照 */
  colorId: string
  /** null = ルート/自由ピン */
  connection: Connection | null
  /** connection が null のとき必須。connection があるときは無視（保存時省略） */
  transform?: Transform
}

export interface PaletteColor {
  id: string
  name: string
  hex: string
}

export interface ProjectMeta {
  name: string
  createdAt: string // ISO 8601
  modifiedAt: string // ISO 8601
  appVersion: string
}

export interface Project {
  format: 'clothespin-studio-project'
  version: number
  unit: 'mm'
  meta: ProjectMeta
  palette: PaletteColor[]
  pins: Pin[]
}

export const PROJECT_FORMAT = 'clothespin-studio-project' as const
export const PROJECT_VERSION = 1

/**
 * 外部モデル（GLB 等）取り込みの中間表現（three 非依存の純データ）。
 * ボクセル化（後続 Issue）の入力。normalize 適用後は単位 mm・Z-up・接地（min.z = 0）を想定する。
 */
export interface MeshData {
  /** xyz 連続の頂点座標。単位は入力（読み込み元）依存。`normalizeMesh` 適用後は単位 mm・Z-up・接地（min.z = 0） */
  positions: Float32Array
  /** 三角形インデックス */
  indices: Uint32Array
  /**
   * 頂点ごとの RGB（0-1）。モデル全体でマテリアル色/頂点色が一切取得できなければ undefined。
   * 存在する場合は全頂点に有効な色が入る: 色あり・なしのメッシュが混在するモデルでは、
   * 色を持たないメッシュの頂点は白（1,1,1 = glTF のデフォルトマテリアル色）で補完される
   */
  vertexColors?: Float32Array
}
