// 洗濯バサミ（ピン）の幾何定義。docs/02-clothespin-spec.md を正とする。
//
// ローカル座標系（右手系・単位 mm）:
//   原点 = 金属スプリング中心 / +X = 鼻先(JAW)方向 / +Z = 高さ / +Y = 厚み
//
// ⚠️ 接続点の position/normal/tangent は暫定値。M2 の連結実装時に
//    プロシージャル形状と突き合わせて視覚的に校正する（シンボル名は不変）。

import type { Vec3 } from '../types'

/** バウンディング寸法 (mm)。長さ X / 厚み Y / 高さ Z */
export const DIMENSIONS = {
  length: 60,
  thickness: 12,
  height: 39,
} as const

/** 金属スプリングリング（コイル軸 = Y） */
export const SPRING = {
  radius: 10,
  wireRadius: 1.2,
} as const

/**
 * プラスチック本体。2 本のレバーがピボット（原点付近）で X 字に交差する:
 *   上レバー = 上ハンドル + 下ジョー / 下レバー = 下ハンドル + 上ジョー
 * 各レバーは「ハンドル区間」と「ジョー区間」の 2 セグメントで近似する（屈曲点 = bendZ）。
 */
export const BODY = {
  /** 本体幅 (Y) */
  width: 12,
  /** ハンドル区間の板厚 (Z 方向, 回転前) */
  handleThickness: 5,
  /** ジョー区間の板厚。先端同士が z=0 で接する（閉じた口） */
  jawThickness: 3.5,
  /** 屈曲点の高さ。上レバー +bendZ / 下レバー −bendZ */
  bendZ: 0.5,
  /** 上ハンドル先端の中心位置 (X-Z 平面) */
  handleTip: { x: -28, z: 17 },
  /** 上ジョー先端の中心位置。上ジョーは「下レバー」に属する（交差構造） */
  jawTip: { x: 30, z: 1.75 },
} as const

/** X-Z 平面内のセグメント（レバー区間）。Y は本体幅いっぱい */
export interface BodySegment {
  from: { x: number; z: number }
  to: { x: number; z: number }
  thickness: number
}

/** 本体 4 セグメント。プロシージャルメッシュもここから生成する（接続点と単一の定義を共有） */
export const BODY_SEGMENTS: readonly BodySegment[] = [
  // 上レバー: 上ハンドル + 下ジョー
  {
    from: { x: 0, z: BODY.bendZ },
    to: { x: BODY.handleTip.x, z: BODY.handleTip.z },
    thickness: BODY.handleThickness,
  },
  {
    from: { x: 0, z: BODY.bendZ },
    to: { x: BODY.jawTip.x, z: -BODY.jawTip.z },
    thickness: BODY.jawThickness,
  },
  // 下レバー: 下ハンドル + 上ジョー
  {
    from: { x: 0, z: -BODY.bendZ },
    to: { x: BODY.handleTip.x, z: -BODY.handleTip.z },
    thickness: BODY.handleThickness,
  },
  {
    from: { x: 0, z: -BODY.bendZ },
    to: { x: BODY.jawTip.x, z: BODY.jawTip.z },
    thickness: BODY.jawThickness,
  },
] as const

/** roll / pitch の量子化ステップ（度）。docs/02 §5.1 */
export const ROTATION_STEP_DEG = 30

export type SocketKind = 'flat-tip' | 'ring-wire'

/** 接続点のローカルフレーム。normal ⊥ tangent（いずれも単位ベクトル） */
export interface ConnectorFrame {
  position: Vec3
  /** 面の外向き法線。相手の JAW はこの逆向きから噛む。roll の回転軸 */
  normal: Vec3
  /** roll=0 の基準方向。ring-wire では線（ワイヤ）方向 = pitch の回転軸 */
  tangent: Vec3
}

export interface GripSocket extends ConnectorFrame {
  /** Connection.gripIndex に対応（g0=0 … g6=6） */
  index: number
  id: 'g0' | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6'
  kind: SocketKind
  /** roll の物理範囲（±度）。離散有効値は allowedAngles() で導出 */
  rollMaxAbsDeg: number
  /** pitch の物理範囲（±度）。null = pitch なし（1 自由度） */
  pitchMaxAbsDeg: number | null
}

/** セグメントの先端方向（from→to）の単位ベクトル (X-Z 平面) */
function outwardDir(seg: BodySegment): Vec3 {
  const dx = seg.to.x - seg.from.x
  const dz = seg.to.z - seg.from.z
  const len = Math.hypot(dx, dz)
  return [dx / len, 0, dz / len]
}

/** X-Z 平面内で dir に直交し、z 成分が正となる単位ベクトル */
function perpUp(dir: Vec3): Vec3 {
  const [dx, , dz] = dir
  // 直交候補 (−dz, 0, dx) / (dz, 0, −dx) のうち z 成分が正の方
  return dx >= 0 ? [-dz, 0, dx] : [dz, 0, -dx]
}

const upperHandleDir = outwardDir(BODY_SEGMENTS[0]) // ≈ (−0.86, 0, +0.51)
const upperJawDir = outwardDir(BODY_SEGMENTS[3]) // ≈ (+1.0, 0, +0.07)（上ジョー = 下レバー）

const ROLL_FLAT = 135 // 平たい細先端（実効 ±120°）
const ROLL_RING = 90 // 丸線リング
const PITCH_RING = 90 // g4/g6 のみ。暫定値（docs/02 §7）

const mirrorZ = (v: Vec3): Vec3 => [v[0], v[1], -v[2]]

/** GRIP ソケット 7 点（メス）。docs/02 §4.2 の正準順 */
export const GRIP_SOCKETS: readonly GripSocket[] = [
  {
    index: 0,
    id: 'g0',
    kind: 'flat-tip',
    position: [BODY.handleTip.x, 0, BODY.handleTip.z],
    normal: perpUp(upperHandleDir), // 上ハンドル外面（上向き）
    tangent: upperHandleDir, // 先端の外向き軸
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 1,
    id: 'g1',
    kind: 'flat-tip',
    position: [BODY.handleTip.x, 0, -BODY.handleTip.z],
    normal: mirrorZ(perpUp(upperHandleDir)),
    tangent: mirrorZ(upperHandleDir),
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 2,
    id: 'g2',
    kind: 'flat-tip',
    position: [BODY.jawTip.x, 0, BODY.jawTip.z],
    normal: perpUp(upperJawDir), // 上ジョー外面（上向き）
    tangent: upperJawDir,
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 3,
    id: 'g3',
    kind: 'flat-tip',
    position: [BODY.jawTip.x, 0, -BODY.jawTip.z],
    normal: mirrorZ(perpUp(upperJawDir)),
    tangent: mirrorZ(upperJawDir),
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 4,
    id: 'g4',
    kind: 'ring-wire',
    position: [0, 0, SPRING.radius],
    normal: [0, 0, 1],
    tangent: [1, 0, 0], // リング頂点でのワイヤ方向
    rollMaxAbsDeg: ROLL_RING,
    pitchMaxAbsDeg: PITCH_RING,
  },
  {
    index: 5,
    id: 'g5',
    kind: 'ring-wire',
    position: [-SPRING.radius, 0, 0],
    normal: [-1, 0, 0],
    tangent: [0, 0, 1],
    rollMaxAbsDeg: ROLL_RING,
    pitchMaxAbsDeg: null, // g5 は構造上 pitch なし（docs/02 §5.1）
  },
  {
    index: 6,
    id: 'g6',
    kind: 'ring-wire',
    position: [0, 0, -SPRING.radius],
    normal: [0, 0, -1],
    tangent: [1, 0, 0],
    rollMaxAbsDeg: ROLL_RING,
    pitchMaxAbsDeg: PITCH_RING,
  },
] as const

/**
 * JAW コネクタ（オス・1 点）。鼻先の口（ジョー先端同士が接する z=0）。
 * normal = 口の閉じ軸の基準（+Z 側）/ tangent = 噛み合わせ線（口幅 Y 方向）。
 * 接続時は JAW.normal を相手ソケットの −normal に、tangent を tangent に合わせる（roll=0）。
 */
export const JAW: ConnectorFrame = {
  position: [BODY.jawTip.x, 0, 0],
  normal: [0, 0, 1],
  tangent: [0, 1, 0],
}

/**
 * 物理範囲 ±maxAbsDeg 内にある step の倍数（昇順）。
 * 例: maxAbsDeg=135, step=30 → −120 … +120 の 9 値（±135 はグリッド外）
 */
export function allowedAngles(maxAbsDeg: number, stepDeg: number = ROTATION_STEP_DEG): number[] {
  const n = Math.floor(maxAbsDeg / stepDeg)
  const out: number[] = []
  for (let i = -n; i <= n; i++) out.push(i * stepDeg)
  return out
}

/** value が step の倍数かつ ±maxAbsDeg 内にあるか */
export function isAllowedAngle(
  value: number,
  maxAbsDeg: number,
  stepDeg: number = ROTATION_STEP_DEG,
): boolean {
  return Number.isInteger(value / stepDeg) && Math.abs(value) <= maxAbsDeg
}

export function socketByIndex(gripIndex: number): GripSocket | undefined {
  return GRIP_SOCKETS[gripIndex]
}
