// 左上のオーバーレイパネル（M1: 表示確認用の最小 UI）

import type { CSSProperties } from 'react'
import { DEFAULT_PALETTE } from '../assets/palette'

interface Props {
  colorId: string
  onColorChange: (id: string) => void
  showSockets: boolean
  onShowSockets: (v: boolean) => void
  showBounds: boolean
  onShowBounds: (v: boolean) => void
  showAxes: boolean
  onShowAxes: (v: boolean) => void
}

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  padding: '12px 16px',
  background: 'var(--color-panel)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  backdropFilter: 'blur(6px)',
  fontSize: 13,
  lineHeight: 1.8,
  minWidth: 200,
}

export function ControlPanel(props: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Clothespin Studio 🧷</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {DEFAULT_PALETTE.map((c) => (
          <button
            key={c.id}
            title={c.name}
            onClick={() => props.onColorChange(c.id)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              cursor: 'pointer',
              background: c.hex,
              border:
                c.id === props.colorId
                  ? '2px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
            }}
          />
        ))}
      </div>

      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={props.showSockets}
          onChange={(e) => props.onShowSockets(e.target.checked)}
        />{' '}
        接続点（GRIP / JAW）
      </label>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={props.showBounds}
          onChange={(e) => props.onShowBounds(e.target.checked)}
        />{' '}
        寸法ボックス（60×12×39mm）
      </label>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={props.showAxes}
          onChange={(e) => props.onShowAxes(e.target.checked)}
        />{' '}
        ドメイン軸（X赤 Y緑 Z青）
      </label>

      <div style={{ color: 'var(--color-text-dim)', fontSize: 11, marginTop: 8 }}>
        ドラッグ: 回転 / 右ドラッグ: パン / ホイール: ズーム
        <br />
        グリッド 1 マス = 1cm
      </div>
    </div>
  )
}
