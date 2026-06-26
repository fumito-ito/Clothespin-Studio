import { afterEach, describe, expect, it, vi } from 'vitest'
import { imageToReliefCells } from './imageToCells'
import { DEFAULT_PALETTE } from '../assets/palette'

// テスト環境は node（vite.config.ts）なので createImageBitmap / canvas は無い。
// 縮小後の各ピクセル RGBA を直接与え、量子化・しきい値・行数計算だけを検証する。
type Px = [number, number, number, number]

/**
 * width×height のビットマップと、縮小後 cols×rows の固定ピクセル列を返すよう
 * createImageBitmap / document.createElement('canvas') をスタブする。
 * drawImage は no-op、getImageData は pixels をそのまま返す。
 */
function stubCanvas(width: number, height: number, pixels: Px[]) {
  const data = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach((px, i) => data.set(px, i * 4))

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close: vi.fn() })),
  )
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ data }),
      }),
    }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ダミーファイル。スタブした createImageBitmap は入力を無視するので実体は不要
// （Node ランタイムによっては File が未定義のため、生成せずキャストで済ませる）。
const file = {} as File

describe('imageToReliefCells', () => {
  it('アスペクト比から行数を算出し、透明セルを除外して量子化する', async () => {
    // 100×50 の画像 → cols=4, rows=round(50/100*4)=2（立方ボクセルなので比そのまま）
    const px: Px[] = [
      // row 0
      [255, 255, 255, 255], // 白・不透明 → 高さ最大・white
      [0, 0, 0, 0], // 透明 → 除外
      [0, 0, 0, 255], // 黒・不透明 → 高さ1・最近傍は blue
      [12, 72, 163, 255], // #0C48A3 → blue
      // row 1
      [255, 255, 255, 255], // 白
      [177, 162, 154, 255], // #B1A29A → warmgray
      [0, 0, 0, 10], // ほぼ透明（a<128）→ 除外
      [0, 0, 0, 255], // 黒
    ]
    stubCanvas(100, 50, px)

    const r = await imageToReliefCells(
      file,
      { widthTowers: 4, maxHeight: 4, invert: false },
      DEFAULT_PALETTE,
    )

    // アスペクト比からの行数計算
    expect(r.cols).toBe(4)
    expect(r.rows).toBe(2)
    // α しきい値（128）未満の 2 セルが除外される
    expect(r.cells).toHaveLength(6)

    const at = (col: number, row: number) => r.cells.find((c) => c.col === col && c.row === row)
    // 高さ量子化（明るい=高い, maxHeight=4）
    expect(at(0, 0)!.height).toBe(4) // 白 lum=255 → 4
    expect(at(2, 0)!.height).toBe(1) // 黒 lum=0 → max(1, 0)=1
    // 最近傍パレット色マッピング
    expect(at(0, 0)!.colorId).toBe('white')
    expect(at(3, 0)!.colorId).toBe('blue')
    expect(at(1, 1)!.colorId).toBe('warmgray')
    expect(at(2, 0)!.colorId).toBe('blue') // 黒は palette 中 blue が最近傍
    // pinTotal は高さの総和
    expect(r.pinTotal).toBe(r.cells.reduce((s, c) => s + c.height, 0))
  })

  it('invert で暗いほど高くなる', async () => {
    stubCanvas(10, 10, [
      [0, 0, 0, 255], // 黒
      [255, 255, 255, 255], // 白
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ])
    const r = await imageToReliefCells(
      file,
      { widthTowers: 2, maxHeight: 4, invert: true },
      DEFAULT_PALETTE,
    )
    const at = (col: number, row: number) => r.cells.find((c) => c.col === col && c.row === row)
    expect(at(0, 0)!.height).toBe(4) // 黒 → 反転で最大
    expect(at(1, 0)!.height).toBe(1) // 白 → 反転で最小（最低1段）
  })
})
