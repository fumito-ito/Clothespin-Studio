// 洗濯バサミのプロシージャル形状（暫定アセット・単体描画用）。
// ドメイン座標系（Z-up, mm）。形状は scene/geometry.ts（= domain/clothespin.ts の定義）を共有する。
// 通常描画は InstancedMesh（PinInstances）が担い、本コンポーネントは
// 配置プレビューのゴースト表示などの単体用途に使う。

import { useMemo } from 'react'
import { buildPlasticGeometry, buildSpringGeometry } from './geometry'
import { SPRING_COLOR } from '../assets/palette'

const plasticGeometry = buildPlasticGeometry()
const springGeometry = buildSpringGeometry(12, 48)

interface Props {
  colorHex: string
  /** 選択ハイライト（発光） */
  selected?: boolean
  /** 半透明のゴースト表示（配置プレビュー, FR-P8） */
  ghost?: boolean
}

export function ClothespinModel({ colorHex, selected = false, ghost = false }: Props) {
  const ghostProps = useMemo(
    () => (ghost ? { transparent: true, opacity: 0.45, depthWrite: false } : {}),
    [ghost],
  )
  return (
    <group>
      <mesh geometry={plasticGeometry} raycast={ghost ? () => null : undefined}>
        <meshStandardMaterial
          color={colorHex}
          roughness={0.55}
          emissive="#4a8fe7"
          emissiveIntensity={selected ? 0.35 : 0}
          {...ghostProps}
        />
      </mesh>
      <mesh geometry={springGeometry} raycast={ghost ? () => null : undefined}>
        {/* 環境マップなしでも沈まないよう metalness は控えめにする */}
        <meshStandardMaterial
          color={SPRING_COLOR}
          metalness={0.35}
          roughness={0.4}
          {...ghostProps}
        />
      </mesh>
    </group>
  )
}
