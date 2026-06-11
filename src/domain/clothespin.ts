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
 * レバー（プラスチック本体）。2 本が原点近くで X 字に交差する。
 * レバー A: ハンドル端 上(+Z) / ジョー端 下(−Z)。レバー B はその Z 反転。
 */
export const LEVER = {
  length: 61,
  width: 12, // Y
  thickness: 5, // Z（回転前）
  centerX: 1,
  centerZ: 7.75,
  /** レバー長軸が X 軸となす角 */
  angleRad: Math.atan2(18.5, 58),
} as const

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

const sin = Math.sin(LEVER.angleRad)
const cos = Math.cos(LEVER.angleRad)
const half = LEVER.length / 2

/** ハンドル端 / ジョー端の中心位置（レバー長軸上） */
const handleTipX = LEVER.centerX - half * cos // ≈ -28.1
const handleTipZ = LEVER.centerZ + half * sin // ≈ +17.0
const jawTipX = LEVER.centerX + half * cos // ≈ +30.1
const jawTipZ = LEVER.centerZ - half * sin // ≈ +1.5（レバー B の上ジョー）

const ROLL_FLAT = 135 // 平たい細先端（実効 ±120°）
const ROLL_RING = 90 // 丸線リング
const PITCH_RING = 90 // g4/g6 のみ。暫定値（docs/02 §7）

/** GRIP ソケット 7 点（メス）。docs/02 §4.2 の正準順 */
export const GRIP_SOCKETS: readonly GripSocket[] = [
  {
    index: 0,
    id: 'g0',
    kind: 'flat-tip',
    position: [handleTipX, 0, handleTipZ],
    normal: [sin, 0, cos], // 上ハンドル外面（上向き）
    tangent: [-cos, 0, sin], // ハンドル先端の外向き軸
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 1,
    id: 'g1',
    kind: 'flat-tip',
    position: [handleTipX, 0, -handleTipZ],
    normal: [sin, 0, -cos],
    tangent: [-cos, 0, -sin],
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 2,
    id: 'g2',
    kind: 'flat-tip',
    position: [jawTipX, 0, jawTipZ],
    normal: [-sin, 0, cos], // 上ジョー外面（上向き）
    tangent: [cos, 0, sin],
    rollMaxAbsDeg: ROLL_FLAT,
    pitchMaxAbsDeg: null,
  },
  {
    index: 3,
    id: 'g3',
    kind: 'flat-tip',
    position: [jawTipX, 0, -jawTipZ],
    normal: [-sin, 0, -cos],
    tangent: [cos, 0, -sin],
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
 * JAW コネクタ（オス・1 点）。鼻先の口。
 * normal = 口の閉じ軸の基準（+Z 側）/ tangent = 噛み合わせ線（口幅 Y 方向）。
 * 接続時は JAW.normal を相手ソケットの −normal に、tangent を tangent に合わせる（roll=0）。
 */
export const JAW: ConnectorFrame = {
  position: [jawTipX, 0, 0],
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
