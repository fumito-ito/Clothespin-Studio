// フォレスト（木の集合）操作と整合性チェック。docs/03 §1.2 / §2.2 を実装する。

import type { Pin } from '../types'
import { GRIP_SOCKETS, isAllowedAngle, socketByIndex } from './clothespin'

/** parentId → 子ピン一覧 */
export function childrenByParent(pins: readonly Pin[]): Map<string, Pin[]> {
  const map = new Map<string, Pin[]>()
  for (const pin of pins) {
    if (pin.connection === null) continue
    const list = map.get(pin.connection.parentId)
    if (list) list.push(pin)
    else map.set(pin.connection.parentId, [pin])
  }
  return map
}

/** 指定ピンの占有済み GRIP ソケット番号の集合（= 子が嵌っている口） */
export function occupiedSockets(pins: readonly Pin[], parentId: string): Set<number> {
  const set = new Set<number>()
  for (const pin of pins) {
    if (pin.connection?.parentId === parentId) set.add(pin.connection.gripIndex)
  }
  return set
}

/** pinId とその子孫すべての id（削除・複製の単位） */
export function collectSubtree(pins: readonly Pin[], rootId: string): string[] {
  const children = childrenByParent(pins)
  const out: string[] = []
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()!
    out.push(id)
    for (const child of children.get(id) ?? []) stack.push(child.id)
  }
  return out
}

/** childId を newParentId に繋いだ場合に閉路ができるか（= newParentId が childId の子孫か） */
export function wouldCreateCycle(
  pins: readonly Pin[],
  childId: string,
  newParentId: string,
): boolean {
  if (childId === newParentId) return true
  const byId = new Map(pins.map((p) => [p.id, p]))
  let cursor = byId.get(newParentId)
  const visited = new Set<string>()
  while (cursor?.connection) {
    if (cursor.id === childId) return true
    if (visited.has(cursor.id)) return true // 既存データが壊れている場合も閉路扱い
    visited.add(cursor.id)
    cursor = byId.get(cursor.connection.parentId)
  }
  return cursor?.id === childId
}

/**
 * ピン配列の整合性を検証し、違反メッセージの配列を返す（空 = 正常）。
 * docs/03 §2.2 のルールに対応。読込時・テストで使用する。
 */
export function validatePins(pins: readonly Pin[]): string[] {
  const errors: string[] = []
  const byId = new Map<string, Pin>()

  for (const pin of pins) {
    if (byId.has(pin.id)) errors.push(`重複した id: ${pin.id}`)
    byId.set(pin.id, pin)
  }

  const occupied = new Set<string>()
  for (const pin of pins) {
    const conn = pin.connection
    if (conn === null) {
      if (!pin.transform) errors.push(`ルートピン ${pin.id} に transform がない`)
      continue
    }
    if (conn.parentId === pin.id) errors.push(`${pin.id} が自分自身を親にしている`)
    if (!byId.has(conn.parentId)) errors.push(`${pin.id} の親 ${conn.parentId} が存在しない`)

    const socket = socketByIndex(conn.gripIndex)
    if (!socket) {
      errors.push(
        `${pin.id} の gripIndex ${conn.gripIndex} が範囲外（0…${GRIP_SOCKETS.length - 1}）`,
      )
      continue
    }
    const key = `${conn.parentId}:${conn.gripIndex}`
    if (occupied.has(key)) errors.push(`ソケット二重占有: ${conn.parentId} の ${socket.id}`)
    occupied.add(key)

    if (!isAllowedAngle(conn.roll, socket.rollMaxAbsDeg)) {
      errors.push(`${pin.id} の roll ${conn.roll}° が ${socket.id} の許容値でない`)
    }
    const pitch = conn.pitch ?? 0
    if (socket.pitchMaxAbsDeg === null) {
      if (pitch !== 0) errors.push(`${pin.id}: ${socket.id} は pitch を持たない`)
    } else if (!isAllowedAngle(pitch, socket.pitchMaxAbsDeg)) {
      errors.push(`${pin.id} の pitch ${pitch}° が ${socket.id} の許容値でない`)
    }
  }

  // 閉路検出（親を辿って自分に戻るか）
  for (const pin of pins) {
    if (pin.connection && wouldCreateCycle(pins, pin.id, pin.connection.parentId)) {
      errors.push(`閉路を検出: ${pin.id}`)
    }
  }

  return errors
}
