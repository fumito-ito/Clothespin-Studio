// STL 出力（FR-IO5, docs/03 §4.2）。3D プリント想定。
// 単位は mm・Z-up のまま（STL/スライサの事実上の標準）。色情報なし。

import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import type { PaletteColor, Pin } from '../types'
import { buildExportGroup, disposeGroup } from './exportScene'
import { downloadBlob, timestamp } from './download'

export function exportStl(pins: readonly Pin[], palette: readonly PaletteColor[]) {
  const model = buildExportGroup(pins, palette)
  model.updateMatrixWorld(true)
  try {
    const data = new STLExporter().parse(model, { binary: true }) as unknown as DataView
    downloadBlob(
      `clothespin-${timestamp()}.stl`,
      new Blob([data.buffer as ArrayBuffer], { type: 'model/stl' }),
    )
  } finally {
    disposeGroup(model)
  }
}
