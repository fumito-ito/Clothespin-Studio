import { describe, expect, it } from 'vitest'
import { Mesh, MeshStandardMaterial } from 'three'
import { buildExportGroup, disposeGroup } from './exportScene'
import { DEFAULT_PALETTE } from '../assets/palette'
import type { Pin } from '../types'

const root = (id: string, colorId: string, x: number): Pin => ({
  id,
  colorId,
  connection: null,
  transform: { position: [x, 0, 0], rotation: [0, 0, 0, 1] },
})

describe('buildExportGroup', () => {
  it('色ごとの本体メッシュ + スプリングメッシュにマージされる', () => {
    const pins = [root('a', 'blue', 0), root('b', 'blue', 100), root('c', 'white', 200)]
    const group = buildExportGroup(pins, DEFAULT_PALETTE)
    const meshes = group.children.filter((c): c is Mesh => c instanceof Mesh)
    // blue / white / springs の 3 メッシュ
    expect(meshes).toHaveLength(3)
    expect(meshes.map((m) => m.name).sort()).toEqual([
      'plastic-#0C48A3',
      'plastic-#FFFFFF',
      'springs',
    ])
    // blue 本体は 2 ピン分の頂点を持つ
    const blue = meshes.find((m) => m.name === 'plastic-#0C48A3')!
    const white = meshes.find((m) => m.name === 'plastic-#FFFFFF')!
    expect(blue.geometry.attributes.position.count).toBe(
      white.geometry.attributes.position.count * 2,
    )
    // 色がマテリアルに反映される
    expect((blue.material as MeshStandardMaterial).color.getHexString()).toBe('0c48a3')
    disposeGroup(group)
  })

  it('ピンのワールド変換が頂点に焼き込まれる', () => {
    const group = buildExportGroup([root('a', 'blue', 500)], DEFAULT_PALETTE)
    const mesh = group.children.find((c): c is Mesh => c instanceof Mesh && c.name !== 'springs')!
    mesh.geometry.computeBoundingBox()
    const bb = mesh.geometry.boundingBox!
    expect(bb.min.x).toBeGreaterThan(400) // x=500 へ移動済み
    expect(bb.max.x).toBeLessThan(600)
    disposeGroup(group)
  })

  it('空のモデルは空の Group', () => {
    const group = buildExportGroup([], DEFAULT_PALETTE)
    expect(group.children).toHaveLength(0)
  })
})
