// glTF (.glb) 出力（FR-IO4, docs/03 §4.1）。
// glTF 慣例に合わせ Y-up・メートルへ変換する（ドメインは Z-up・mm）。

import { Group } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import type { PaletteColor, Pin } from '../types'
import { buildExportGroup, disposeGroup } from './exportScene'
import { downloadBlob, timestamp } from './download'

export async function exportGlb(pins: readonly Pin[], palette: readonly PaletteColor[]) {
  const model = buildExportGroup(pins, palette)
  const root = new Group()
  root.add(model)
  model.rotation.x = -Math.PI / 2 // Z-up → Y-up
  root.scale.setScalar(0.001) // mm → m
  root.updateMatrixWorld(true)

  try {
    const result = await new GLTFExporter().parseAsync(root, { binary: true })
    const buffer = result as ArrayBuffer
    downloadBlob(`clothespin-${timestamp()}.glb`, new Blob([buffer], { type: 'model/gltf-binary' }))
  } finally {
    disposeGroup(model)
  }
}
