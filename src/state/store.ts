// アプリ状態ストア。変更はコマンド関数経由で行い、ドメイン関数で検証する（docs/04 §4）。
// Undo/Redo: zundo でドキュメント状態（pins）のみを履歴対象にする。

import { create } from 'zustand'
import { temporal } from 'zundo'
import { nanoid } from 'nanoid'
import { Quaternion, Vector3 } from 'three'
import type { Pin, Transform, Vec3 } from '../types'
import { DIMENSIONS, allowedAngles, socketByIndex } from '../domain/clothespin'
import { collectSubtree, occupiedSockets } from '../domain/graph'
import { solveWorldTransforms } from '../domain/solve'
import { DEFAULT_COLOR_ID } from '../assets/palette'
import type { Lang } from '../i18n/messages'

/** ホバー中の GRIP ソケット（配置プレビュー用, FR-P8） */
export interface SocketRef {
  pinId: string
  gripIndex: number
}

const LANG_KEY = 'clothespin-studio.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'ja' || saved === 'en') return saved
  } catch {
    // localStorage 不可なら既定へ
  }
  return navigator.language.startsWith('ja') ? 'ja' : 'en'
}

interface StudioState {
  // ドキュメント状態（履歴対象）
  pins: Pin[]

  // エディタ状態（履歴対象外）
  selectedPinId: string | null
  activeColorId: string
  /** true = 地面クリックでルートピンを配置するモード */
  placementMode: boolean
  hoverSocket: SocketRef | null
  /** 干渉している全ピンを赤表示するか（FR-P7 全体ハイライト） */
  showCollisions: boolean
  /** UI 言語（NFR-7）。localStorage に永続化 */
  lang: Lang

  // コマンド
  addRootPin: (position: Vec3) => void
  connectPin: (parentId: string, gripIndex: number) => void
  deleteSubtree: (pinId: string) => void
  /** 親から切り離して自由ピン化する（現在のワールド姿勢を保持, FR-E3） */
  detachPin: (pinId: string) => void
  /** サブツリーを複製し、オフセットした自由ピンとして配置する（FR-E4） */
  duplicateSubtree: (pinId: string) => void
  stepRoll: (pinId: string, dir: 1 | -1) => void
  stepPitch: (pinId: string, dir: 1 | -1) => void
  setPinColor: (pinId: string, colorId: string) => void
  selectPin: (id: string | null) => void
  setActiveColor: (id: string) => void
  setPlacementMode: (v: boolean) => void
  setHoverSocket: (ref: SocketRef | null) => void
  setShowCollisions: (v: boolean) => void
  setLang: (lang: Lang) => void
}

/** ピンの現在のワールド姿勢を Transform として取り出す */
function worldTransformOf(pins: readonly Pin[], pinId: string): Transform | null {
  const m = solveWorldTransforms(pins).get(pinId)
  if (!m) return null
  const pos = new Vector3()
  const quat = new Quaternion()
  m.decompose(pos, quat, new Vector3())
  return { position: [pos.x, pos.y, pos.z], rotation: [quat.x, quat.y, quat.z, quat.w] }
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
      hoverSocket: null,
      showCollisions: true,
      lang: initialLang(),

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
        // 干渉は赤ゴーストで警告するがブロックはしない（置いた後に roll/pitch で逃がせるため）
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
          hoverSocket: null,
        }))
      },

      detachPin: (pinId) => {
        const { pins } = get()
        const pin = pins.find((p) => p.id === pinId)
        if (!pin?.connection) return
        const transform = worldTransformOf(pins, pinId)
        if (!transform) return
        set((s) => ({
          pins: s.pins.map((p) => (p.id === pinId ? { ...p, connection: null, transform } : p)),
        }))
      },

      duplicateSubtree: (pinId) => {
        const { pins } = get()
        const ids = collectSubtree(pins, pinId)
        const idSet = new Set(ids)
        const idMap = new Map(ids.map((id) => [id, nanoid(8)]))
        const rootTransform = worldTransformOf(pins, pinId)
        if (!rootTransform) return
        const clones: Pin[] = []
        for (const pin of pins) {
          if (!idSet.has(pin.id)) continue
          const id = idMap.get(pin.id)!
          if (pin.id === pinId) {
            // 複製のルートは自由ピン化し、元の姿勢から少しずらして置く
            const [x, y, z] = rootTransform.position
            clones.push({
              id,
              colorId: pin.colorId,
              connection: null,
              transform: { position: [x + 30, y + 30, z], rotation: rootTransform.rotation },
            })
          } else {
            clones.push({
              id,
              colorId: pin.colorId,
              connection: { ...pin.connection!, parentId: idMap.get(pin.connection!.parentId)! },
            })
          }
        }
        set((s) => ({ pins: [...s.pins, ...clones], selectedPinId: idMap.get(pinId)! }))
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
      setHoverSocket: (ref) => set({ hoverSocket: ref }),
      setShowCollisions: (v) => set({ showCollisions: v }),
      setLang: (lang) => {
        set({ lang })
        try {
          localStorage.setItem(LANG_KEY, lang)
        } catch {
          // 永続化できなくても言語切替自体は有効
        }
      },
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

  // 画像→連結アセンブリ生成の動作確認用（プレビュー環境では input.files を設定できないため、
  // 合成画像を実パイプライン imageToReliefCells→cellsToVoxels→growAssembly に通す）。
  w.__genSynthetic = async (widthTowers = 16, maxHeight = 6, invert = false) => {
    const [{ imageToReliefCells }, { cellsToVoxels }, { growAssembly }, { DEFAULT_PALETTE }] =
      await Promise.all([
        import('../io/imageToCells'),
        import('../domain/generator'),
        import('../domain/grow'),
        import('../assets/palette'),
      ])
    const c = document.createElement('canvas')
    c.width = 40
    c.height = 40
    const ctx = c.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 40, 40)
    grad.addColorStop(0, '#0C48A3')
    grad.addColorStop(1, '#ffffff')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 40, 40)
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(20, 20, 9, 0, Math.PI * 2)
    ctx.fill()
    const bin = atob(c.toDataURL('image/png').split(',')[1])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const file = new File([bytes], 'synthetic.png', { type: 'image/png' })
    const result = await imageToReliefCells(file, { widthTowers, maxHeight, invert }, DEFAULT_PALETTE)
    const { voxels, seed } = cellsToVoxels(result.cells)
    const r = growAssembly(voxels, 45, seed)
    useStudio.setState({ pins: r.pins, selectedPinId: null, placementMode: false })
    useStudio.temporal.getState().clear()
    return { cols: result.cols, rows: result.rows, covered: r.covered, target: r.target, pins: r.pins.length }
  }

  // ルールベース生成アセンブリの可視化デモ（docs/07）。目標ボクセル集合を種から
  // 充填し、1 つの連結木（干渉なし）を生成する。shape: 'sphere'|'pyramid'
  w.__grow = async (shape = 'sphere', V = 45) => {
    const { growAssembly } = await import('../domain/grow')
    const colors = ['blue', 'white', 'warmgray']
    const voxels = new Map<string, string>()
    let seed: string
    if (shape === 'pyramid') {
      const n = 9
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const h = 1 + Math.min(i, n - 1 - i, j, n - 1 - j)
          for (let k = 0; k < h; k++) voxels.set(`${i},${j},${k}`, colors[(i + j + k) % 3])
        }
      seed = '4,4,0'
    } else {
      const R = 4
      for (let i = -R; i <= R; i++)
        for (let j = -R; j <= R; j++)
          for (let k = -R; k <= R; k++)
            if (i * i + j * j + k * k <= R * R)
              voxels.set(`${i + R},${j + R},${k + R}`, colors[(i + j + k + 3 * R) % 3])
      seed = '4,4,4'
    }
    const t0 = performance.now()
    const r = growAssembly(voxels, V, seed)
    const ms = Math.round(performance.now() - t0)
    useStudio.setState({ pins: r.pins, selectedPinId: null, placementMode: false })
    useStudio.temporal.getState().clear()
    return { shape, pins: r.pins.length, covered: r.covered, target: r.target, ms }
  }
}
