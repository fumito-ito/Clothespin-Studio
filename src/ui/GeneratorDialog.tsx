// 画像 → 連結アセンブリ生成ダイアログ（docs/07）。
// 画像選択 → 量子化プレビュー + ピン数見積もり → 成長生成（連結構造でモデルを置き換え）。

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import type { Pin } from '../types'
import { DEFAULT_PALETTE } from '../assets/palette'
import { cellsToVoxels } from '../domain/generator'
import { growAssembly } from '../domain/grow'
import { computeBounds } from '../domain/bounds'
import { imageToReliefCells, type ImageReliefResult } from '../io/imageToCells'
import { useT, t as tNow } from '../i18n'
import { useStudio } from '../state/store'
import { frameView } from './actions'
import { Btn } from './Btn'

/** 立方ボクセルの一辺 (mm)。被覆率実測で 45mm が好結果 */
const VOXEL_MM = 45
/** 生成上限（描画性能の安全マージン, NFR-2） */
const PIN_LIMIT = 20000

/** 構造の最下点を地面(Z=0)へ合わせる。単一ルートの z を持ち上げると木全体が追従する */
function liftToGround(pins: Pin[]): Pin[] {
  const b = computeBounds(pins)
  if (!b || b.min[2] === 0) return pins
  const lift = -b.min[2]
  return pins.map((p) =>
    p.connection === null && p.transform
      ? {
          ...p,
          transform: {
            ...p.transform,
            position: [
              p.transform.position[0],
              p.transform.position[1],
              p.transform.position[2] + lift,
            ],
          },
        }
      : p,
  )
}

const overlayStyle: CSSProperties = {
  // portal で body 直下に描画する（ControlPanel の backdrop-filter 配下だと fixed が
  // ビューポートではなくパネルに内包されてしまうため）。
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 10,
}

const dialogStyle: CSSProperties = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: 20,
  width: 320,
  fontSize: 13,
  lineHeight: 1.9,
}

const HEX_BY_ID = new Map(DEFAULT_PALETTE.map((c) => [c.id, c.hex]))

interface Props {
  onClose: () => void
}

export function GeneratorDialog({ onClose }: Props) {
  const t = useT()
  const [file, setFile] = useState<File | null>(null)
  const [widthTowers, setWidthTowers] = useState(16)
  const [maxHeight, setMaxHeight] = useState(6)
  const [invert, setInvert] = useState(false)
  const [result, setResult] = useState<ImageReliefResult | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)

  // パラメータ変更のたびにセルを再計算してプレビュー描画
  // （ファイル未選択時のクリアは onChange 側で行う。setState を effect 内で同期呼びしない）
  useEffect(() => {
    if (!file) return
    let cancelled = false
    // スライダー連続操作で画像デコード（createImageBitmap）が多発しないようデバウンス
    const timer = setTimeout(() => {
      imageToReliefCells(file, { widthTowers, maxHeight, invert }, DEFAULT_PALETTE)
        .then((r) => {
          if (cancelled) return
          setResult(r)
          const canvas = previewRef.current
          if (!canvas) return
          canvas.width = r.cols
          canvas.height = r.rows
          const ctx = canvas.getContext('2d')!
          ctx.clearRect(0, 0, r.cols, r.rows)
          for (const cell of r.cells) {
            ctx.fillStyle = HEX_BY_ID.get(cell.colorId) ?? '#888888'
            // 高さを少し明暗に反映してプレビューに起伏感を出す
            ctx.globalAlpha = 0.45 + (0.55 * cell.height) / maxHeight
            ctx.fillRect(cell.col, cell.row, 1, 1)
          }
          ctx.globalAlpha = 1
        })
        .catch((err) => {
          // デコード失敗（非対応/破損画像など）。古い見積もりを残さずクリアする
          if (cancelled) return
          console.error('imageToReliefCells failed', err)
          setResult(null)
        })
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [file, widthTowers, maxHeight, invert])

  const tooMany = (result?.pinTotal ?? 0) > PIN_LIMIT

  const generate = () => {
    if (!result || tooMany) return
    const { pins } = useStudio.getState()
    if (pins.length > 0 && !window.confirm(tNow('confirmReplace', { n: pins.length }))) return
    // 画像セル（高さ場）→ ボクセル目標 → 連結アセンブリを成長生成（docs/07）
    const { voxels, seed } = cellsToVoxels(result.cells)
    const grown = growAssembly(voxels, VOXEL_MM, seed)
    // 構造全体を地面(Z=0)に接地させる（ルートの z を持ち上げると木全体が追従）
    const pinsOut = liftToGround(grown.pins)
    useStudio.setState({ pins: pinsOut, selectedPinId: null, placementMode: false })
    useStudio.temporal.getState().clear()
    onClose()
    requestAnimationFrame(() => frameView('iso'))
  }

  return createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gen-dialog-title"
      >
        <div id="gen-dialog-title" style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          {t('genTitle')}
        </div>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            // ファイルをクリアしたら古い見積もり/プレビューを残さない
            if (!f) setResult(null)
          }}
          style={{ fontSize: 12, marginBottom: 8, maxWidth: '100%' }}
        />

        {file && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <canvas
              ref={previewRef}
              style={{
                width: 220,
                imageRendering: 'pixelated',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                background: '#111',
              }}
            />
          </div>
        )}

        <label style={{ display: 'block' }}>
          {t('genWidth')}: {widthTowers}
          <input
            type="range"
            min={8}
            max={40}
            value={widthTowers}
            onChange={(e) => setWidthTowers(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label style={{ display: 'block' }}>
          {t('genMaxHeight')}: {maxHeight}
          <input
            type="range"
            min={1}
            max={12}
            value={maxHeight}
            onChange={(e) => setMaxHeight(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />{' '}
          {t('genInvert')}
        </label>

        {result && (
          <div
            style={{
              color: tooMany ? '#f87171' : 'var(--color-text-dim)',
              fontSize: 12,
              marginTop: 6,
            }}
          >
            {t('genEstimate', { cols: result.cols, rows: result.rows, n: result.pinTotal })}
            {tooMany && (
              <>
                <br />
                {t('genTooMany', { n: PIN_LIMIT })}
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn onClick={onClose}>{t('genCancel')}</Btn>
          <Btn onClick={generate} disabled={!result || tooMany}>
            {t('genGenerate')}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
