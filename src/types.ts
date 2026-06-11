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
  /** 度。30° 刻み。許容範囲はソケット種別で異なる（docs/02 §5.1） */
  roll: number
  /** 度。30° 刻み。丸線リング (g4/g6) のみ有効。省略時は 0 */
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
