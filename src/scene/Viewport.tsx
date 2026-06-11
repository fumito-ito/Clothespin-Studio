// 3D ビューポート。
// ワールドは three.js 慣例の Y-up。ドメイン座標系（Z-up, docs/02 §3）のコンテンツは
// ルートの <group rotation={[-π/2,0,0]}> 内に置くことで Z-up → Y-up に写す（docs/04 §5）。
// 地面 = ドメイン Z=0 平面 = ワールド XZ 平面。

import { Canvas } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei'
import { DIMENSIONS } from '../domain/clothespin'
import { ClothespinModel } from './ClothespinModel'
import { SocketMarkers } from './SocketMarkers'

interface Props {
  colorHex: string
  showSockets: boolean
  showBounds: boolean
  showAxes: boolean
}

export function Viewport({ colorHex, showSockets, showBounds, showAxes }: Props) {
  return (
    <Canvas camera={{ position: [70, 60, 95], fov: 40, near: 1, far: 5000 }}>
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
        fadeDistance={600}
        followCamera={false}
      />
      <ContactShadows position={[0, 0.1, 0]} opacity={0.35} scale={250} blur={2.2} far={60} />

      {/* ドメイン座標系 (Z-up) */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {/* ピンを地面に載せる（原点 = スプリング中心なので高さの半分持ち上げる） */}
        <group position={[0, 0, DIMENSIONS.height / 2]}>
          <ClothespinModel colorHex={colorHex} />
          {showSockets && <SocketMarkers />}
          {showBounds && (
            <mesh>
              <boxGeometry args={[DIMENSIONS.length, DIMENSIONS.thickness, DIMENSIONS.height]} />
              <meshBasicMaterial color="#4a8fe7" wireframe transparent opacity={0.6} />
            </mesh>
          )}
        </group>
        {/* ドメイン軸: X=赤(鼻先) Y=緑(厚み) Z=青(高さ) */}
        {showAxes && <axesHelper args={[30]} />}
      </group>

      <OrbitControls makeDefault target={[0, DIMENSIONS.height / 2, 0]} />
    </Canvas>
  )
}
