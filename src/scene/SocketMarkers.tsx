// 選択中ピンの GRIP ソケットマーカー（ピンのローカル座標系内に描画）。
// クリックで新規ピンをスナップ連結する（FR-P3）。占有済みソケットはグレー表示・無効。
// 色分け: アンバー = 1自由度（g0–g3: roll / g5: pitch）/ ティール = 2自由度（g4,g6）

import { useState } from 'react'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { GRIP_SOCKETS } from '../domain/clothespin'
import type { GripSocket } from '../domain/clothespin'
import { useStudio } from '../state/store'

const COLOR_1DOF = '#f59e0b'
const COLOR_2DOF = '#14b8a6'
const COLOR_OCCUPIED = '#5b6273'

interface Props {
  pinId: string
  occupied: Set<number>
}

function Marker({
  socket,
  pinId,
  isOccupied,
}: {
  socket: GripSocket
  pinId: string
  isOccupied: boolean
}) {
  const connectPin = useStudio((s) => s.connectPin)
  const setHoverSocket = useStudio((s) => s.setHoverSocket)
  const [hovered, setHovered] = useState(false)

  const dof = (socket.rollMaxAbsDeg > 0 ? 1 : 0) + (socket.pitchMaxAbsDeg !== null ? 1 : 0)
  const color = isOccupied ? COLOR_OCCUPIED : dof === 2 ? COLOR_2DOF : COLOR_1DOF

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!isOccupied) {
      setHoverSocket(null)
      connectPin(pinId, socket.index)
    }
  }

  return (
    <group position={socket.position}>
      <mesh
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (!isOccupied) {
            setHovered(true)
            setHoverSocket({ pinId, gripIndex: socket.index }) // 配置プレビュー（FR-P8）
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={() => {
          setHovered(false)
          setHoverSocket(null)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[hovered ? 2.2 : 1.6, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={isOccupied ? 0.5 : 0.9} />
      </mesh>
      <Html
        position={[socket.normal[0] * 5, socket.normal[1] * 5, socket.normal[2] * 5]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <span
          style={{
            color,
            fontSize: 11,
            fontWeight: 700,
            textShadow: '0 0 4px #000',
            userSelect: 'none',
          }}
        >
          {socket.id}
        </span>
      </Html>
    </group>
  )
}

export function SocketMarkers({ pinId, occupied }: Props) {
  return (
    <group>
      {GRIP_SOCKETS.map((s) => (
        <Marker key={s.id} socket={s} pinId={pinId} isOccupied={occupied.has(s.index)} />
      ))}
    </group>
  )
}
