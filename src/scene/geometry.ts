// 洗濯バサミのプロシージャルジオメトリ生成（描画・エクスポート共用）。
// 形状定義は domain/clothespin.ts の BODY_SEGMENTS / SPRING を単一の正とする。

import { BoxGeometry, TorusGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BODY, BODY_SEGMENTS, SPRING } from '../domain/clothespin'

/** 本体 4 セグメントを 1 ジオメトリに結合する */
export function buildPlasticGeometry(): BufferGeometry {
  const parts = BODY_SEGMENTS.map((seg) => {
    const dx = seg.to.x - seg.from.x
    const dz = seg.to.z - seg.from.z
    const g = new BoxGeometry(Math.hypot(dx, dz), BODY.width, seg.thickness)
    g.rotateY(Math.atan2(-dz, dx))
    g.translate((seg.from.x + seg.to.x) / 2, 0, (seg.from.z + seg.to.z) / 2)
    return g
  })
  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return merged
}

/** 金属スプリングリング（コイル軸 = Y）。segments は用途に応じて調整 */
export function buildSpringGeometry(radialSegments = 8, tubularSegments = 24): BufferGeometry {
  return new TorusGeometry(
    SPRING.radius,
    SPRING.wireRadius,
    radialSegments,
    tubularSegments,
  ).rotateX(Math.PI / 2)
}
