// 左上のオーバーレイパネル。配置・色・選択中ピンの操作・統計・入出力（M2–M3）。

import { useMemo, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { DEFAULT_PALETTE } from '../assets/palette'
import { allowedAngles, socketByIndex } from '../domain/clothespin'
import { buildBom } from '../domain/bom'
import { computeBounds } from '../domain/bounds'
import { useCollidingPins } from '../state/useCollidingPins'
import { COLOR_NAME_KEYS, useT } from '../i18n'
import { redo, undo, useStudio } from '../state/store'
import {
  confirmAndDelete,
  exportBomCsv,
  exportGlbAction,
  exportPng,
  exportStlAction,
  frameView,
  loadProjectFile,
  saveProjectFile,
} from './actions'

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
  const lang = useStudio((s) => s.lang)
  const setLang = useStudio((s) => s.setLang)
  const showCollisions = useStudio((s) => s.showCollisions)
  const setShowCollisions = useStudio((s) => s.setShowCollisions)
  const t = useT()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selected = pins.find((p) => p.id === selectedPinId)
  const socket = selected?.connection ? socketByIndex(selected.connection.gripIndex) : undefined
  const bom = useMemo(() => buildBom(pins, DEFAULT_PALETTE), [pins])
  const bounds = useMemo(() => computeBounds(pins), [pins])
  // PinInstances と同じ集合を共有（pins ごとに 1 回だけ計算）
  const collisionCount = useCollidingPins().size
  const cm = (mm: number) => (mm / 10).toFixed(1)
  const colorName = (colorId: string, fallback: string) => {
    const key = COLOR_NAME_KEYS[colorId]
    return key ? t(key) : fallback
  }

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Clothespin Studio 🧷</span>
        <Btn onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}>
          {lang === 'ja' ? 'EN' : 'JA'}
        </Btn>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        {DEFAULT_PALETTE.map((c) => (
          <button
            key={c.id}
            title={colorName(c.id, c.name)}
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
          {t('pinCount', { n: pins.length })}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <Btn onClick={() => setPlacementMode(!placementMode)} active={placementMode}>
          {placementMode ? t('cancelPlace') : t('placeRoot')}
        </Btn>
      </div>

      {/* 視点（FR-V3/V5） */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <Btn onClick={() => frameView('front')}>{t('viewFront')}</Btn>
        <Btn onClick={() => frameView('top')}>{t('viewTop')}</Btn>
        <Btn onClick={() => frameView('side')}>{t('viewSide')}</Btn>
        <Btn onClick={() => frameView('iso')}>{t('viewIso')}</Btn>
        <Btn onClick={() => frameView()}>{t('viewFit')}</Btn>
      </div>

      {/* 干渉の全体ハイライト（FR-P7） */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showCollisions}
            onChange={(e) => setShowCollisions(e.target.checked)}
          />{' '}
          {t('showCollisions')}
        </label>
        {showCollisions && collisionCount > 0 && (
          <div style={{ color: '#e23b3b', fontSize: 12 }}>
            {t('collisionCount', { n: collisionCount })}
          </div>
        )}
      </div>
      {placementMode && (
        <div style={{ color: 'var(--color-accent)', fontSize: 12, marginBottom: 8 }}>
          {t('placementHint')}
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
            {t('selectedLabel', { id: selected.id })}
            {selected.connection
              ? t('selectedConn', {
                  parent: selected.connection.parentId,
                  socket: socket?.id ?? '',
                })
              : t('selectedRoot')}
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
                  ? t('rollRange', { n: Math.max(...allowedAngles(socket.rollMaxAbsDeg)) })
                  : t('rollNone')}
                {socket.pitchMaxAbsDeg !== null && t('pitchRange', { n: socket.pitchMaxAbsDeg })}
              </div>
            </>
          )}

          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn onClick={() => useStudio.getState().duplicateSubtree(selected.id)}>
              {t('duplicate')}
            </Btn>
            {selected.connection && (
              <Btn onClick={() => useStudio.getState().detachPin(selected.id)}>{t('detach')}</Btn>
            )}
            <Btn onClick={() => confirmAndDelete(selected.id)}>{t('delete')}</Btn>
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
              <span style={{ flex: 1 }}>{colorName(row.colorId, row.colorName)}</span>
              <span>{row.count}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>{t('total')}</span>
            <span>{bom.total}</span>
          </div>
          {bounds && (
            <div style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
              {t('sizeLabel', {
                x: cm(bounds.size[0]),
                y: cm(bounds.size[1]),
                z: cm(bounds.size[2]),
              })}
            </div>
          )}
        </div>
      )}

      {/* 入出力（FR-IO1/2/3） */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <Btn onClick={saveProjectFile} disabled={pins.length === 0}>
          {t('save')}
        </Btn>
        <Btn onClick={() => fileInputRef.current?.click()}>{t('load')}</Btn>
        <Btn onClick={exportBomCsv} disabled={pins.length === 0}>
          CSV
        </Btn>
      </div>

      {/* エクスポート（FR-IO4/5/6） */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <Btn onClick={exportGlbAction} disabled={pins.length === 0}>
          GLB
        </Btn>
        <Btn onClick={exportStlAction} disabled={pins.length === 0}>
          STL
        </Btn>
        <Btn onClick={exportPng}>PNG</Btn>
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
        {t('helpLine1')}
        <br />
        {t('helpLine2')}
        <br />
        {t('helpLine3')}
        <br />
        {t('helpLine4')}
      </div>
    </div>
  )
}
