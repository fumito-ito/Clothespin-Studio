// PNG 出力（FR-IO6, docs/03 §5）。
// preserveDrawingBuffer なしでも確実に取得できるよう、直前に 1 フレーム描画してから読み出す。

import { viewport } from '../scene/viewportHandle'
import { downloadBlob, timestamp } from './download'

export function exportPng() {
  const { gl, scene, camera } = viewport
  if (!gl || !scene || !camera) return
  gl.render(scene, camera)
  gl.domElement.toBlob((blob) => {
    if (blob) downloadBlob(`clothespin-${timestamp()}.png`, blob)
  }, 'image/png')
}
