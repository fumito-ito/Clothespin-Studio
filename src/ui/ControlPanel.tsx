// 左上のオーバーレイパネル。配置・色・選択中ピンの操作・統計・入出力（M2–M3）。

import { useMemo, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { DEFAULT_PALETTE } from '../assets/palette'
import { allowedAngles, socketByIndex } from '../domain/clothespin'
import { buildBom } from '../domain/bom'
import { redo, undo, useStudio } from '../state/store'
import { confirmAndDelete, exportBomCsv, loadProjectFile, saveProjectFile } from './actions'

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
  width: 230,
}

const buttonStyle: CSSProperties = {
  background: '#262b34',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 12,
}

function Btn({
  onClick,
  active,
  disabled,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...buttonStyle,
        ...(active ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : {}),
        ...(disabled ? { opacity: 0.4, cursor: 'default' } : {}),
      }}
    >
      {children}
    </button>
  )
}

export function ControlPanel() {
  const pins = useStudio((s) => s.pins)
  const selectedPinId = useStudio((s) => s.selectedPinId)
  const activeColorId = useStudio((s) => s.activeColorId)
  const placementMode = useStudio((s) => s.placementMode)
  const setPlacementMode = useStudio((s) => s.setPlacementMode)
  const setActiveColor = useStudio((s) => s.setActiveColor)
  const stepRoll = useStudio((s) => s.stepRoll)
  const stepPitch = useStudio((s) => s.stepPitch)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selected = pins.find((p) => p.id === selectedPinId)
  const socket = selected?.connection ? socketByIndex(selected.connection.gripIndex) : undefined
  const bom = useMemo(() => buildBom(pins, DEFAULT_PALETTE), [pins])

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Clothespin Studio 🧷</div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        {DEFAULT_PALETTE.map((c) => (
          <button
            key={c.id}
            title={c.name}
            onClick={() => setActiveColor(c.id)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              cursor: 'pointer',
              background: c.hex,
              border:
                c.id === activeColorId
                  ? '2px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
            }}
          />
        ))}
        <span style={{ color: 'var(--color-text-dim)', fontSize: 11, marginLeft: 4 }}>
          {pins.length} ピン
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <Btn onClick={() => setPlacementMode(!placementMode)} active={placementMode}>
          {placementMode ? '配置をキャンセル (Esc)' : '🧷 ルートピンを配置'}
        </Btn>
      </div>
      {placementMode && (
        <div style={{ color: 'var(--color-accent)', fontSize: 12, marginBottom: 8 }}>
          地面をクリックして配置（1cm スナップ）
        </div>
      )}

      {selected && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: 8,
            marginBottom: 4,
          }}
        >
          <div style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
            選択中: {selected.id}{' '}
            {selected.connection
              ? `（親 ${selected.connection.parentId} の ${socket?.id}）`
              : '（ルート）'}
          </div>

          {selected.connection && socket && (
            <>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 38 }}>roll</span>
                <Btn
                  onClick={() => stepRoll(selected.id, -1)}
                  disabled={socket.rollMaxAbsDeg === 0}
                >
                  −30°
                </Btn>
                <span style={{ width: 44, textAlign: 'center' }}>
                  {socket.rollMaxAbsDeg === 0 ? '—' : `${selected.connection.roll}°`}
                </span>
                <Btn onClick={() => stepRoll(selected.id, 1)} disabled={socket.rollMaxAbsDeg === 0}>
                  +30°
                </Btn>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 38 }}>pitch</span>
                <Btn
                  onClick={() => stepPitch(selected.id, -1)}
                  disabled={socket.pitchMaxAbsDeg === null}
                >
                  −30°
                </Btn>
                <span style={{ width: 44, textAlign: 'center' }}>
                  {socket.pitchMaxAbsDeg === null ? '—' : `${selected.connection.pitch ?? 0}°`}
                </span>
                <Btn
                  onClick={() => stepPitch(selected.id, 1)}
                  disabled={socket.pitchMaxAbsDeg === null}
                >
                  +30°
                </Btn>
              </div>
              <div style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
                {socket.rollMaxAbsDeg > 0
                  ? `roll 範囲 ±${Math.max(...allowedAngles(socket.rollMaxAbsDeg))}°`
                  : 'roll 不可'}
                {socket.pitchMaxAbsDeg !== null && ` / pitch 範囲 ±${socket.pitchMaxAbsDeg}°`}
              </div>
            </>
          )}

          <div style={{ marginTop: 6 }}>
            <Btn onClick={() => confirmAndDelete(selected.id)}>削除 (Del)</Btn>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <Btn onClick={undo}>↩ Undo</Btn>
        <Btn onClick={redo}>↪ Redo</Btn>
      </div>

      {/* 部品表（FR-S1/S2） */}
      {bom.total > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 8, paddingTop: 6 }}>
          {bom.rows.map((row) => (
            <div key={row.colorId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: row.hex,
                  border: '1px solid var(--color-border)',
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{row.colorName}</span>
              <span>{row.count}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>合計</span>
            <span>{bom.total}</span>
          </div>
        </div>
      )}

      {/* 入出力（FR-IO1/2/3） */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <Btn onClick={saveProjectFile} disabled={pins.length === 0}>
          💾 保存
        </Btn>
        <Btn onClick={() => fileInputRef.current?.click()}>📂 読込</Btn>
        <Btn onClick={exportBomCsv} disabled={pins.length === 0}>
          CSV
        </Btn>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void loadProjectFile(file)
          e.target.value = '' // 同じファイルの再選択を可能にする
        }}
      />

      <div style={{ color: 'var(--color-text-dim)', fontSize: 11, marginTop: 8 }}>
        ピンをクリック = 選択 / ソケット球クリック = 連結
        <br />[ ] = roll / {'{ }'} = pitch / Del = 削除 / ⌘Z = Undo
        <br />
        ドラッグ: 回転 / 右ドラッグ: パン / ホイール: ズーム
      </div>
    </div>
  )
}
