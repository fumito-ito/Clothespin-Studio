// 接続点（GRIP / JAW）の可視化マーカー。位置・法線の校正と選択 UI（M2）の土台。
// 色分け: アンバー = roll のみ（1自由度）/ ティール = roll+pitch（2自由度）/ コーラル = JAW

import { Html, Line } from '@react-three/drei'
import { GRIP_SOCKETS, JAW } from '../domain/clothespin'
import type { ConnectorFrame } from '../domain/clothespin'
import type { Vec3 } from '../types'

const COLOR_1DOF = '#f59e0b'
const COLOR_2DOF = '#14b8a6'
const COLOR_JAW = '#ef6c4d'
const NORMAL_LENGTH = 6 // mm

function addScaled(p: Vec3, dir: Vec3, s: number): Vec3 {
  return [p[0] + dir[0] * s, p[1] + dir[1] * s, p[2] + dir[2] * s]
}

function Marker({ frame, color, label }: { frame: ConnectorFrame; color: string; label: string }) {
  const tip = addScaled(frame.position, frame.normal, NORMAL_LENGTH)
  return (
    <group>
      <mesh position={frame.position}>
        <sphereGeometry args={[1.4, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Line points={[frame.position, tip]} color={color} lineWidth={2} />
      <Html position={addScaled(frame.position, frame.normal, NORMAL_LENGTH + 2)} center>
        <span
          style={{
            color,
            fontSize: 11,
            fontWeight: 700,
            textShadow: '0 0 4px #000',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {label}
        </span>
      </Html>
    </group>
  )
}

export function SocketMarkers() {
  return (
    <group>
      {GRIP_SOCKETS.map((s) => (
        <Marker
          key={s.id}
          frame={s}
          color={s.pitchMaxAbsDeg !== null ? COLOR_2DOF : COLOR_1DOF}
          label={s.id}
        />
      ))}
      <Marker frame={JAW} color={COLOR_JAW} label="JAW" />
    </group>
  )
}
