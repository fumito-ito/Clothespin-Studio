// 3D ビューポート。
// ワールドは three.js 慣例の Y-up。ドメイン座標系（Z-up, docs/02 §3）のコンテンツは
// ルートの <group rotation={[-π/2,0,0]}> 内に置くことで Z-up → Y-up に写す（docs/04 §5）。
// 地面 = ドメイン Z=0 平面 = ワールド XZ 平面。

import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { useStudio } from '../state/store'
import { PinInstances } from './PinInstances'
import { GroundPlane } from './GroundPlane'

export function Viewport() {
  const selectPin = useStudio((s) => s.selectPin)

  return (
    <Canvas
      camera={{ position: [110, 90, 150], fov: 40, near: 1, far: 5000 }}
      onPointerMissed={() => selectPin(null)}
    >
      <color attach="background" args={['#1a1d23']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[80, 120, 60]} intensity={1.4} />
      <directionalLight position={[-60, 40, -80]} intensity={0.4} />

      {/* 1 セル = 10mm(1cm), 太線 = 100mm(10cm) */}
      <Grid
        infiniteGrid
        cellSize={10}
        sectionSize={100}
        cellColor="#3a3f4b"
        sectionColor="#5b6273"
        fadeDistance={800}
        followCamera={false}
      />
      {/* ドメイン座標系 (Z-up) */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <PinInstances />
        <GroundPlane />
      </group>

      <OrbitControls makeDefault target={[0, 25, 0]} />
    </Canvas>
  )
}
