import { useEffect } from 'react'
import { Viewport } from '../scene/Viewport'
import { ControlPanel } from '../ui/ControlPanel'
import { confirmAndDelete } from '../ui/actions'
import { redo, undo, useStudio } from '../state/store'
import { initBackup } from '../state/backup'

export default function App() {
  // 自動バックアップ（FR-IO7）
  useEffect(() => {
    initBackup()
  }, [])

  // キーボードショートカット（NFR-8）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const {
        selectedPinId,
        placementMode,
        selectPin,
        setPlacementMode,
        stepRoll,
        stepPitch,
        duplicateSubtree,
      } = useStudio.getState()

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (selectedPinId) duplicateSubtree(selectedPinId)
        return
      }

      switch (e.key) {
        case 'Escape':
          if (placementMode) setPlacementMode(false)
          else selectPin(null)
          break
        case '[':
          if (selectedPinId) stepRoll(selectedPinId, -1)
          break
        case ']':
          if (selectedPinId) stepRoll(selectedPinId, 1)
          break
        case '{':
          if (selectedPinId) stepPitch(selectedPinId, -1)
          break
        case '}':
          if (selectedPinId) stepPitch(selectedPinId, 1)
          break
        case 'Delete':
        case 'Backspace':
          if (selectedPinId) confirmAndDelete(selectedPinId)
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Viewport />
      <ControlPanel />
    </div>
  )
}
