// ルートピン配置用の地面クリックキャッチャー（配置モード時のみ描画）。
// ドメイン座標系（Z-up）内に置くので、平面 = ドメイン X-Y 平面そのもの。
// クリック位置はローカル変換でドメイン座標を得て 1cm グリッドにスナップする。

import { Vector3 } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { ROOT_PIN_Z, useStudio } from '../state/store'

const SNAP_MM = 10

export function GroundPlane() {
  const placementMode = useStudio((s) => s.placementMode)
  const addRootPin = useStudio((s) => s.addRootPin)

  if (!placementMode) return null

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const local = e.object.worldToLocal(new Vector3().copy(e.point))
    const snap = (v: number) => Math.round(v / SNAP_MM) * SNAP_MM
    addRootPin([snap(local.x), snap(local.y), ROOT_PIN_Z])
  }

  return (
    <mesh onClick={handleClick}>
      <planeGeometry args={[4000, 4000]} />
      <meshBasicMaterial color="#4a8fe7" transparent opacity={0.07} depthWrite={false} />
    </mesh>
  )
}
