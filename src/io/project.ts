// プロジェクトファイル（.clothespin.json）の直列化・読込。docs/03 §2。
// 読込はバリデーション（docs/03 §2.2）とバージョンマイグレーション（§2.3）を通す。

import type { PaletteColor, Pin, Project } from '../types'
import { PROJECT_FORMAT, PROJECT_VERSION } from '../types'
import { validatePins } from '../domain/graph'

export const APP_VERSION = '0.1.0'
export const FILE_EXTENSION = '.clothespin.json'

/** 現在のドキュメント状態から保存用 Project を組み立てる */
export function serializeProject(
  pins: readonly Pin[],
  palette: readonly PaletteColor[],
  name = 'untitled',
): Project {
  const now = new Date().toISOString()
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    unit: 'mm',
    meta: { name, createdAt: now, modifiedAt: now, appVersion: APP_VERSION },
    palette: [...palette],
    // connection を持つピンの transform は保存しない（docs/03 §2.2）
    pins: pins.map((p) =>
      p.connection !== null ? { id: p.id, colorId: p.colorId, connection: p.connection } : p,
    ),
  }
}

export interface ParseResult {
  project?: Project
  errors: string[]
}

/**
 * バージョンごとのマイグレーション関数チェーン。
 * v(n) → v(n+1) の変換を index [n] に置く（現行 v1 のため空）。
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {}

function migrate(raw: Record<string, unknown>): { raw: Record<string, unknown>; errors: string[] } {
  let version = raw.version
  if (typeof version !== 'number') return { raw, errors: ['version がありません'] }
  if (version > PROJECT_VERSION) {
    return { raw, errors: [`未対応のバージョンです（v${version} > 対応上限 v${PROJECT_VERSION}）`] }
  }
  let current = raw
  while (version < PROJECT_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return { raw: current, errors: [`v${version} からのマイグレーション未定義`] }
    current = step(current)
    version += 1
  }
  return { raw: current, errors: [] }
}

/** JSON 文字列を検証付きで読み込む。errors が空でなければ project は不定 */
export function parseProject(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { errors: ['JSON として解釈できません'] }
  }
  if (typeof raw !== 'object' || raw === null) return { errors: ['オブジェクトではありません'] }

  const obj = raw as Record<string, unknown>
  if (obj.format !== PROJECT_FORMAT) {
    return { errors: [`format が "${PROJECT_FORMAT}" ではありません`] }
  }

  const migrated = migrate(obj)
  if (migrated.errors.length > 0) return { errors: migrated.errors }
  const m = migrated.raw

  if (m.unit !== 'mm') return { errors: ['unit は "mm" のみ対応しています'] }
  if (!Array.isArray(m.pins)) return { errors: ['pins が配列ではありません'] }
  if (!Array.isArray(m.palette)) return { errors: ['palette が配列ではありません'] }

  const pins = m.pins as Pin[]
  const structureErrors = validatePins(pins)
  // 構造チェックの前提となる最低限の形チェック
  for (const p of pins) {
    if (typeof p?.id !== 'string' || typeof p?.colorId !== 'string') {
      structureErrors.push('id / colorId が不正なピンがあります')
      break
    }
  }
  if (structureErrors.length > 0) return { errors: structureErrors }

  return { project: m as unknown as Project, errors: [] }
}
