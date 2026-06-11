// 洗濯バサミのプロシージャル形状（暫定アセット）。
// ドメイン座標系（Z-up, mm）で構築する。形状は domain/clothespin.ts の BODY_SEGMENTS を
// そのまま描画し、接続点定義との整合を保つ。M4 以降に手モデリング GLB へ差し替え予定（docs/02 §6）。

import { BODY, BODY_SEGMENTS, SPRING } from '../domain/clothespin'
import type { BodySegment } from '../domain/clothespin'
import { SPRING_COLOR } from '../assets/palette'

interface Props {
  colorHex: string
}

/** X-Z 平面内のセグメントを box で描く。長軸 = X、回転は Y 軸まわり */
function SegmentBox({ seg, colorHex }: { seg: BodySegment; colorHex: string }) {
  const dx = seg.to.x - seg.from.x
  const dz = seg.to.z - seg.from.z
  const length = Math.hypot(dx, dz)
  // box の +X 端が to を向くように: R_y(θ) は +X を (cosθ, 0, −sinθ) へ写す
  const rotY = Math.atan2(-dz, dx)
  const cx = (seg.from.x + seg.to.x) / 2
  const cz = (seg.from.z + seg.to.z) / 2
  return (
    <mesh position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
      <boxGeometry args={[length, BODY.width, seg.thickness]} />
      <meshStandardMaterial color={colorHex} roughness={0.55} />
    </mesh>
  )
}

export function ClothespinModel({ colorHex }: Props) {
  return (
    <group>
      {BODY_SEGMENTS.map((seg, i) => (
        <SegmentBox key={i} seg={seg} colorHex={colorHex} />
      ))}
      {/* 金属スプリングリング（コイル軸 = Y）。torus 既定は XY 平面なので X 軸 90° 回転 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[SPRING.radius, SPRING.wireRadius, 12, 48]} />
        {/* 環境マップなしでも沈まないよう metalness は控えめにする */}
        <meshStandardMaterial color={SPRING_COLOR} metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  )
}
