// アプリ状態ストア。変更はコマンド関数経由で行い、ドメイン関数で検証する（docs/04 §4）。
// Undo/Redo: zundo でドキュメント状態（pins）のみを履歴対象にする。

import { create } from 'zustand'
import { temporal } from 'zundo'
import { nanoid } from 'nanoid'
import type { Pin, Vec3 } from '../types'
import { DIMENSIONS, allowedAngles, socketByIndex } from '../domain/clothespin'
import { collectSubtree, occupiedSockets } from '../domain/graph'
import { DEFAULT_COLOR_ID } from '../assets/palette'

interface StudioState {
  // ドキュメント状態（履歴対象）
  pins: Pin[]

  // エディタ状態（履歴対象外）
  selectedPinId: string | null
  activeColorId: string
  /** true = 地面クリックでルートピンを配置するモード */
  placementMode: boolean

  // コマンド
  addRootPin: (position: Vec3) => void
  connectPin: (parentId: string, gripIndex: number) => void
  deleteSubtree: (pinId: string) => void
  stepRoll: (pinId: string, dir: 1 | -1) => void
  stepPitch: (pinId: string, dir: 1 | -1) => void
  setPinColor: (pinId: string, colorId: string) => void
  selectPin: (id: string | null) => void
  setActiveColor: (id: string) => void
  setPlacementMode: (v: boolean) => void
}

/** 角度を許容リスト内で 1 ステップ進める（端でクランプ） */
function stepAngle(current: number, maxAbsDeg: number, dir: 1 | -1): number {
  const angles = allowedAngles(maxAbsDeg)
  const i = angles.indexOf(current)
  const next = (i === -1 ? angles.indexOf(0) : i) + dir
  return angles[Math.max(0, Math.min(angles.length - 1, next))]
}

export const useStudio = create<StudioState>()(
  temporal(
    (set, get) => ({
      pins: [],
      selectedPinId: null,
      activeColorId: DEFAULT_COLOR_ID,
      placementMode: false,

      addRootPin: (position) => {
        const pin: Pin = {
          id: nanoid(8),
          colorId: get().activeColorId,
          connection: null,
          transform: { position, rotation: [0, 0, 0, 1] },
        }
        set((s) => ({ pins: [...s.pins, pin], selectedPinId: pin.id, placementMode: false }))
      },

      connectPin: (parentId, gripIndex) => {
        const { pins, activeColorId } = get()
        if (!socketByIndex(gripIndex)) return
        if (occupiedSockets(pins, parentId).has(gripIndex)) return
        if (!pins.some((p) => p.id === parentId)) return
        const pin: Pin = {
          id: nanoid(8),
          colorId: activeColorId,
          connection: { parentId, gripIndex, roll: 0 },
        }
        set((s) => ({ pins: [...s.pins, pin], selectedPinId: pin.id }))
      },

      deleteSubtree: (pinId) => {
        const doomed = new Set(collectSubtree(get().pins, pinId))
        set((s) => ({
          pins: s.pins.filter((p) => !doomed.has(p.id)),
          selectedPinId: doomed.has(s.selectedPinId ?? '') ? null : s.selectedPinId,
        }))
      },

      stepRoll: (pinId, dir) => {
        set((s) => ({
          pins: s.pins.map((p) => {
            if (p.id !== pinId || !p.connection) return p
            const socket = socketByIndex(p.connection.gripIndex)
            if (!socket) return p
            const roll = stepAngle(p.connection.roll, socket.rollMaxAbsDeg, dir)
            return roll === p.connection.roll ? p : { ...p, connection: { ...p.connection, roll } }
          }),
        }))
      },

      stepPitch: (pinId, dir) => {
        set((s) => ({
          pins: s.pins.map((p) => {
            if (p.id !== pinId || !p.connection) return p
            const socket = socketByIndex(p.connection.gripIndex)
            if (!socket || socket.pitchMaxAbsDeg === null) return p
            const pitch = stepAngle(p.connection.pitch ?? 0, socket.pitchMaxAbsDeg, dir)
            return pitch === (p.connection.pitch ?? 0)
              ? p
              : { ...p, connection: { ...p.connection, pitch } }
          }),
        }))
      },

      setPinColor: (pinId, colorId) => {
        set((s) => ({
          pins: s.pins.map((p) => (p.id === pinId ? { ...p, colorId } : p)),
        }))
      },

      selectPin: (id) => set({ selectedPinId: id }),
      setActiveColor: (id) => {
        const { selectedPinId } = get()
        set({ activeColorId: id })
        // 選択中のピンがあれば色も変える（FR-E6: 配置後の変更）
        if (selectedPinId) get().setPinColor(selectedPinId, id)
      },
      setPlacementMode: (v) => set({ placementMode: v }),
    }),
    {
      // 履歴対象はドキュメント状態のみ
      partialize: (s) => ({ pins: s.pins }),
      equality: (a, b) => a.pins === b.pins,
    },
  ),
)

/** 地面クリック位置（ドメイン座標）にルートピンを置くときの既定 Z（接地） */
export const ROOT_PIN_Z = DIMENSIONS.height / 2

export const undo = () => useStudio.temporal.getState().undo()
export const redo = () => useStudio.temporal.getState().redo()

// 開発時のみ: コンソール / E2E からストアを操作できるようにする
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>
  w.__studio = useStudio

  // 負荷テスト用シーン生成（NFR-1）: g4 連結のタワーを格子状に並べる
  w.__stress = (total: number, perTower = 100) => {
    const colors = ['blue', 'white', 'warmgray']
    const towers = Math.ceil(total / perTower)
    const cols = Math.ceil(Math.sqrt(towers))
    const pins: Pin[] = []
    let count = 0
    for (let t = 0; t < towers && count < total; t++) {
      const x = (t % cols) * 100 - (cols - 1) * 50
      const y = Math.floor(t / cols) * 100 - (cols - 1) * 50
      let parentId = `s${t}`
      pins.push({
        id: parentId,
        colorId: colors[t % 3],
        connection: null,
        transform: { position: [x, y, ROOT_PIN_Z], rotation: [0, 0, 0, 1] },
      })
      count++
      for (let i = 1; i < perTower && count < total; i++) {
        const id = `s${t}-${i}`
        pins.push({
          id,
          colorId: colors[(t + i) % 3],
          connection: { parentId, gripIndex: 4, roll: 0 },
        })
        parentId = id
        count++
      }
    }
    useStudio.setState({ pins, selectedPinId: null, placementMode: false })
    useStudio.temporal.getState().clear()
    return count
  }
}
