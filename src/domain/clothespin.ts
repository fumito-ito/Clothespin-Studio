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

/**
 * 接続点のローカルフレーム。normal ⊥ tangent（いずれも単位ベクトル）。
 * - normal: 子の閉じ軸（squeeze）= roll の回転軸。相手 JAW の閉じ軸（±Z）がこの軸に揃う。
 *   平先端 = 先端面の法線（面上のプロペラ回転）
 *   リング = コイル軸 ±Y（コイル軸まわり = ピン平面に平行な面内回転）
 * - tangent: = normal × outward = pitch の回転軸。
 *   平先端 = ±Y（幅方向）→ 子は親と同一平面（先端タブが子の口幅に収まる）
 *   リング = 接続点での局所ワイヤ方向 → 子の幅（Y）がワイヤに沿う = 子は親と直交し、
 *   双方の金属スプリングは「ねじれの位置」になる（ユーザーFB反映・物理的に正しい噛み方）
 * - outward（定義素・非保持）: 基準姿勢（roll=pitch=0）で子ピンの本体が伸びる向き。
 *   すべて親の X-Z 面内（部材の延長 / 真上 / 真後ろ / 真下）。
 */
export interface ConnectorFrame {
  position: Vec3
  normal: Vec3
  tangent: Vec3
}

export interface GripSocket extends ConnectorFrame {
  /** Connection.gripIndex に対応（g0=0 … g6=6） */
  index: number
  id: 'g0' | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6'
  kind: SocketKind
  /** roll の物理範囲（±度）。離散有効値は allowedAngles() で導出。0 = roll 不可 */
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

// 成分の +0 は −0 の正規化
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1] + 0,
  a[2] * b[0] - a[0] * b[2] + 0,
  a[0] * b[1] - a[1] * b[0] + 0,
]

/**
 * 挟み込み軸 normal と基準姿勢の伸長方向 outward からフレームを構成する。
 * tangent = normal × outward により、roll=pitch=0 で子ピンの本体が outward 方向に
 * 伸びる（solve の FLIP 規約と整合: 子の本体方向 = tangent × normal = outward）。
 */
function gripFrame(position: Vec3, normal: Vec3, outward: Vec3) {
  return { position, normal, tangent: cross(normal, outward) }
}

const upperHandleDir = outwardDir(BODY_SEGMENTS[0]) // ≈ (−0.86, 0, +0.51)
const upperJawDir = outwardDir(BODY_SEGMENTS[3]) // ≈ (+1.0, 0, +0.07)（上ジョー = 下レバー）

// 回転範囲（ユーザーFB確定値）: 30° グリッドに整合
const ROLL_FLAT = 90 // 平先端: 延長方向 ±90°（それ以上は親と重なる）
const ROLL_RING = 90 // g4/g6: コイル軸まわりの面内回転
const ROLL_NONE = 0 // g5: roll 不可（後方は親ハンドルが塞ぐ）
const PITCH_RING = 90 // リング系: ワイヤまわりの首振り

const mirrorZ = (v: Vec3): Vec3 => [v[0], v[1], -v[2]]

/** GRIP ソケット 7 点（メス）。docs/02 §4.2 の正準順。既定姿勢: 平先端 = 同一平面 / リング = 直交 */
export const GRIP_SOCKETS: readonly GripSocket[] = [
  {
    index: 0,
    id: 'g0',
    kind: 'flat-tip',
    // 上ハンドル先端: 既定 = ハンドルの延長方向に伸びる
    ...gripFrame([BODY.handleTip.x, 0, BODY.handleTip.z], perpUp(upperHandleDir), upperHandleDir),
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 1,
    id: 'g1',
    kind: 'flat-tip',
    ...gripFrame(
      [BODY.handleTip.x, 0, -BODY.handleTip.z],
      mirrorZ(perpUp(upperHandleDir)),
      mirrorZ(upperHandleDir),
    ),
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 2,
    id: 'g2',
    kind: 'flat-tip',
    // 上ジョー先端: 既定 = ジョーの延長方向（ほぼ +X）に伸びる
    ...gripFrame([BODY.jawTip.x, 0, BODY.jawTip.z], perpUp(upperJawDir), upperJawDir),
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 3,
    id: 'g3',
    kind: 'flat-tip',
    ...gripFrame(
      [BODY.jawTip.x, 0, -BODY.jawTip.z],
      mirrorZ(perpUp(upperJawDir)),
      mirrorZ(upperJawDir),
    ),
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 4,
    id: 'g4',
    kind: 'ring-wire',
    // リング上: 既定 = 真上に立つ。normal = コイル軸(+Y) → tangent = ワイヤ方向(+X)。
    // 子の幅(Y)がワイヤに沿う = 子は親と直交（スプリング同士はねじれの位置）。
    // roll = コイル軸まわりの面内傾き / pitch = ワイヤまわりの首振り
    ...gripFrame([0, 0, SPRING.radius], [0, 1, 0], [0, 0, 1]),
    rollMaxAbsDeg: ROLL_RING,
    pitchMaxAbsDeg: PITCH_RING,
  },
  {
    index: 5,
    id: 'g5',
    kind: 'ring-wire',
    // リング後ろ（ハンドル側）: 既定 = 真後ろに伸びる（親と直交）。tangent = ワイヤ方向(+Z)。
    // pitch のみ（面内回転は親ハンドルと干渉するため roll 不可）
    ...gripFrame([-SPRING.radius, 0, 0], [0, 1, 0], [-1, 0, 0]),
    rollMaxAbsDeg: ROLL_NONE,
    pitchMaxAbsDeg: PITCH_RING,
  },
  {
    index: 6,
    id: 'g6',
    kind: 'ring-wire',
    // リング下: 既定 = 真下に伸びる（親と直交）。tangent = ワイヤ方向(−X)
    ...gripFrame([0, 0, -SPRING.radius], [0, 1, 0], [0, 0, -1]),
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
  for (let i = -n; i <= n; i++) out.push(i * stepDeg + 0) // +0: −0 を正規化
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
