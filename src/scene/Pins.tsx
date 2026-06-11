// 全ピンの描画。ストアの pins から solve でワールド姿勢を導出して配置する。
// 選択中のピンには GRIP ソケットマーカーを表示する（FR-P2）。
// M2 は 1 ピン = 1 group の素朴な描画。InstancedMesh 化は M3（docs/04 §5）。

import { useMemo } from 'react'
import { Quaternion, Vector3 } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useStudio } from '../state/store'
import { solveWorldTransforms } from '../domain/solve'
import { occupiedSockets } from '../domain/graph'
import { DEFAULT_PALETTE } from '../assets/palette'
import { ClothespinModel } from './ClothespinModel'
import { SocketMarkers } from './SocketMarkers'

const HEX_BY_ID = new Map(DEFAULT_PALETTE.map((c) => [c.id, c.hex]))

export function Pins() {
  const pins = useStudio((s) => s.pins)
  const selectedPinId = useStudio((s) => s.selectedPinId)
  const selectPin = useStudio((s) => s.selectPin)

  const placed = useMemo(() => {
    const matrices = solveWorldTransforms(pins)
    return pins.flatMap((pin) => {
      const m = matrices.get(pin.id)
      if (!m) return []
      const position = new Vector3()
      const quaternion = new Quaternion()
      m.decompose(position, quaternion, new Vector3())
      return [{ pin, position, quaternion }]
    })
  }, [pins])

  const selectedOccupied = useMemo(
    () => (selectedPinId ? occupiedSockets(pins, selectedPinId) : null),
    [pins, selectedPinId],
  )

  const handleClick = (pinId: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    selectPin(pinId)
  }

  return (
    <>
      {placed.map(({ pin, position, quaternion }) => (
        <group key={pin.id} position={position} quaternion={quaternion}>
          <group onClick={handleClick(pin.id)}>
            <ClothespinModel
              colorHex={HEX_BY_ID.get(pin.colorId) ?? '#888888'}
              selected={pin.id === selectedPinId}
            />
          </group>
          {pin.id === selectedPinId && selectedOccupied && (
            <SocketMarkers pinId={pin.id} occupied={selectedOccupied} />
          )}
        </group>
      ))}
    </>
  )
}
