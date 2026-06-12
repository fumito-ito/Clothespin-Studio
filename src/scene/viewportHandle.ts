// Canvas 外（UI アクション）から renderer / camera / controls にアクセスするためのハンドル。
// Viewport 内の <ViewportBridge /> が設定する。PNG 出力・視点プリセット・Zoom to fit で使用。

import type { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'

export interface OrbitControlsLike {
  target: Vector3
  update: () => void
}

export interface ViewportHandle {
  gl?: WebGLRenderer
  scene?: Scene
  camera?: PerspectiveCamera
  controls?: OrbitControlsLike
}

export const viewport: ViewportHandle = {}
