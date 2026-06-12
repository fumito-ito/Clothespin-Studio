// 3D エクスポート用のシーン構築（glTF / STL 共用, docs/03 §4）。
// 表示用 InstancedMesh とは別経路で、色ごとにジオメトリをマージした Group を組み立てる。
// 座標系はドメイン（Z-up, mm）のまま。座標変換・スケールは各エクスポータ側で行う。

import { Group, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PaletteColor, Pin } from '../types'
import { solveWorldTransforms } from '../domain/solve'
import { buildPlasticGeometry, buildSpringGeometry } from '../scene/geometry'
import { SPRING_COLOR } from '../assets/palette'

const FALLBACK_HEX = '#888888'

/** 色ごとにマージした本体メッシュ + 全スプリングのメッシュを持つ Group を作る */
export function buildExportGroup(pins: readonly Pin[], palette: readonly PaletteColor[]): Group {
  const matrices = solveWorldTransforms(pins)
  const plasticBase = buildPlasticGeometry()
  const springBase = buildSpringGeometry(12, 48)
  const hexById = new Map(palette.map((c) => [c.id, c.hex]))

  const plasticByHex = new Map<string, BufferGeometry[]>()
  const springGeos: BufferGeometry[] = []

  for (const pin of pins) {
    const m = matrices.get(pin.id)
    if (!m) continue
    const hex = hexById.get(pin.colorId) ?? FALLBACK_HEX
    const list = plasticByHex.get(hex)
    const plastic = plasticBase.clone().applyMatrix4(m)
    if (list) list.push(plastic)
    else plasticByHex.set(hex, [plastic])
    springGeos.push(springBase.clone().applyMatrix4(m))
  }

  const group = new Group()
  group.name = 'clothespin-model'
  for (const [hex, geos] of plasticByHex) {
    const merged = mergeGeometries(geos)
    geos.forEach((g) => g.dispose())
    const mesh = new Mesh(merged, new MeshStandardMaterial({ color: hex, roughness: 0.55 }))
    mesh.name = `plastic-${hex}`
    group.add(mesh)
  }
  if (springGeos.length > 0) {
    const merged = mergeGeometries(springGeos)
    springGeos.forEach((g) => g.dispose())
    const mesh = new Mesh(
      merged,
      new MeshStandardMaterial({ color: SPRING_COLOR, metalness: 0.35, roughness: 0.4 }),
    )
    mesh.name = 'springs'
    group.add(mesh)
  }
  plasticBase.dispose()
  springBase.dispose()
  return group
}

/** エクスポート後のジオメトリ破棄 */
export function disposeGroup(group: Group) {
  group.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.geometry.dispose()
      if (obj.material instanceof MeshStandardMaterial) obj.material.dispose()
    }
  })
}
