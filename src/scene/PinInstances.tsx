// InstancedMesh による全ピン描画（docs/04 §5, NFR-1: 5,000 ピン対応）。
// 本体（4 セグメント結合）と金属スプリングの 2 つの InstancedMesh = 2 ドローコール。
// 色は instanceColor、選択ハイライトはアクセント色への lerp で表現する。
// クリックは instanceId からピンを特定。ソケットマーカーは選択ピンにのみ表示。

import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  Color,
  Quaternion,
  TorusGeometry,
  Vector3,
  type InstancedMesh as TInstancedMesh,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ThreeEvent } from '@react-three/fiber'
import { BODY, BODY_SEGMENTS, SPRING } from '../domain/clothespin'
import { solveWorldTransforms } from '../domain/solve'
import { occupiedSockets } from '../domain/graph'
import { useStudio } from '../state/store'
import { DEFAULT_PALETTE, SPRING_COLOR } from '../assets/palette'
import { SocketMarkers } from './SocketMarkers'

/** 本体 4 セグメントを 1 ジオメトリに結合（ClothespinModel と同じ構成・モジュールで 1 回だけ） */
function buildPlasticGeometry() {
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

const plasticGeometry = buildPlasticGeometry()
// インスタンス描画用は控えめなポリゴン数にする（5,000 個で約 1.9M tri）
const springGeometry = new TorusGeometry(SPRING.radius, SPRING.wireRadius, 8, 24).rotateX(
  Math.PI / 2,
)

const HEX_BY_ID = new Map(DEFAULT_PALETTE.map((c) => [c.id, c.hex]))
const HIGHLIGHT = new Color('#4a8fe7')
const FALLBACK_HEX = '#888888'

export function PinInstances() {
  const pins = useStudio((s) => s.pins)
  const selectedPinId = useStudio((s) => s.selectedPinId)
  const selectPin = useStudio((s) => s.selectPin)

  const matrices = useMemo(() => solveWorldTransforms(pins), [pins])
  const placed = useMemo(() => pins.filter((p) => matrices.has(p.id)), [pins, matrices])

  // 容量は 2 冪で確保し、超えたら key で作り直す
  const capacity = Math.max(256, 2 ** Math.ceil(Math.log2(Math.max(1, placed.length))))
  const plasticRef = useRef<TInstancedMesh>(null)
  const springRef = useRef<TInstancedMesh>(null)

  useLayoutEffect(() => {
    const plastic = plasticRef.current
    const spring = springRef.current
    if (!plastic || !spring) return
    const color = new Color()
    placed.forEach((pin, i) => {
      const m = matrices.get(pin.id)!
      plastic.setMatrixAt(i, m)
      spring.setMatrixAt(i, m)
      color.set(HEX_BY_ID.get(pin.colorId) ?? FALLBACK_HEX)
      if (pin.id === selectedPinId) color.lerp(HIGHLIGHT, 0.5)
      plastic.setColorAt(i, color)
    })
    plastic.count = placed.length
    spring.count = placed.length
    plastic.instanceMatrix.needsUpdate = true
    spring.instanceMatrix.needsUpdate = true
    if (plastic.instanceColor) plastic.instanceColor.needsUpdate = true
    plastic.computeBoundingSphere()
    spring.computeBoundingSphere()
  }, [placed, matrices, selectedPinId])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const i = e.instanceId
    if (i !== undefined && i < placed.length) selectPin(placed[i].id)
  }

  // 選択ピンのワールド姿勢（ソケットマーカー配置用）
  const selectedWorld = selectedPinId ? matrices.get(selectedPinId) : undefined
  const selectedPose = useMemo(() => {
    if (!selectedWorld) return null
    const position = new Vector3()
    const quaternion = new Quaternion()
    selectedWorld.decompose(position, quaternion, new Vector3())
    return { position, quaternion }
  }, [selectedWorld])

  const selectedOccupied = useMemo(
    () => (selectedPinId ? occupiedSockets(pins, selectedPinId) : null),
    [pins, selectedPinId],
  )

  return (
    <>
      <instancedMesh
        key={`plastic-${capacity}`}
        ref={plasticRef}
        args={[undefined, undefined, capacity]}
        onClick={handleClick}
      >
        <primitive object={plasticGeometry} attach="geometry" />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <instancedMesh
        key={`spring-${capacity}`}
        ref={springRef}
        args={[undefined, undefined, capacity]}
        onClick={handleClick}
      >
        <primitive object={springGeometry} attach="geometry" />
        <meshStandardMaterial color={SPRING_COLOR} metalness={0.35} roughness={0.4} />
      </instancedMesh>

      {selectedPinId && selectedPose && selectedOccupied && (
        <group position={selectedPose.position} quaternion={selectedPose.quaternion}>
          <SocketMarkers pinId={selectedPinId} occupied={selectedOccupied} />
        </group>
      )}
    </>
  )
}
