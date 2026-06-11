import { useState } from 'react'
import { Viewport } from '../scene/Viewport'
import { ControlPanel } from '../ui/ControlPanel'
import { DEFAULT_COLOR_ID, DEFAULT_PALETTE } from '../assets/palette'

export default function App() {
  const [colorId, setColorId] = useState<string>(DEFAULT_COLOR_ID)
  const [showSockets, setShowSockets] = useState(true)
  const [showBounds, setShowBounds] = useState(false)
  const [showAxes, setShowAxes] = useState(false)

  const colorHex = DEFAULT_PALETTE.find((c) => c.id === colorId)?.hex ?? '#0C48A3'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Viewport
        colorHex={colorHex}
        showSockets={showSockets}
        showBounds={showBounds}
        showAxes={showAxes}
      />
      <ControlPanel
        colorId={colorId}
        onColorChange={setColorId}
        showSockets={showSockets}
        onShowSockets={setShowSockets}
        showBounds={showBounds}
        onShowBounds={setShowBounds}
        showAxes={showAxes}
        onShowAxes={setShowAxes}
      />
    </div>
  )
}
