// UI 文言の辞書（NFR-7: 日本語 / 英語）。軽量自前方式（docs/04 §1）。
// {var} プレースホルダは translate() の vars で展開する。

export type Lang = 'ja' | 'en'

const MESSAGES = {
  // パネル
  pinCount: { ja: '{n} ピン', en: '{n} pins' },
  placeRoot: { ja: '🧷 ルートピンを配置', en: '🧷 Place root pin' },
  cancelPlace: { ja: '配置をキャンセル (Esc)', en: 'Cancel placement (Esc)' },
  placementHint: {
    ja: '地面をクリックして配置（1cm スナップ）',
    en: 'Click the ground to place (1cm snap)',
  },
  viewFront: { ja: '正面', en: 'Front' },
  viewTop: { ja: '上', en: 'Top' },
  viewSide: { ja: '横', en: 'Side' },
  viewIso: { ja: '等角', en: 'Iso' },
  viewFit: { ja: '⊡ Fit', en: '⊡ Fit' },
  selectedLabel: { ja: '選択中: {id} ', en: 'Selected: {id} ' },
  selectedRoot: { ja: '（ルート）', en: '(root)' },
  selectedConn: { ja: '（親 {parent} の {socket}）', en: '(on {socket} of {parent})' },
  rollNone: { ja: 'roll 不可', en: 'no roll' },
  rollRange: { ja: 'roll 範囲 ±{n}°', en: 'roll range ±{n}°' },
  pitchRange: { ja: ' / pitch 範囲 ±{n}°', en: ' / pitch range ±{n}°' },
  duplicate: { ja: '複製 (⌘D)', en: 'Duplicate (⌘D)' },
  detach: { ja: '切り離し', en: 'Detach' },
  delete: { ja: '削除 (Del)', en: 'Delete (Del)' },
  total: { ja: '合計', en: 'Total' },
  sizeLabel: {
    ja: 'サイズ: {x} × {y} × {z} cm（長さ×厚み×高さ）',
    en: 'Size: {x} × {y} × {z} cm (L × T × H)',
  },
  save: { ja: '💾 保存', en: '💾 Save' },
  load: { ja: '📂 読込', en: '📂 Load' },
  showCollisions: { ja: '干渉を表示', en: 'Show collisions' },
  collisionCount: { ja: '⚠ {n} 個のピンが干渉', en: '⚠ {n} pin(s) colliding' },
  helpLine1: {
    ja: 'ピンをクリック = 選択 / ソケット球クリック = 連結',
    en: 'Click pin = select / click socket = connect',
  },
  helpLine2: {
    ja: '[ ] = roll / { } = pitch / Del = 削除',
    en: '[ ] = roll / { } = pitch / Del = delete',
  },
  helpLine3: {
    ja: '⌘Z = Undo / ⇧⌘Z = Redo / ⌘D = 複製',
    en: '⌘Z = undo / ⇧⌘Z = redo / ⌘D = duplicate',
  },
  helpLine4: {
    ja: 'ドラッグ: 回転 / 右ドラッグ: パン / ホイール: ズーム',
    en: 'Drag: orbit / right-drag: pan / wheel: zoom',
  },

  // 画像→レリーフ生成（Stage A）
  genOpen: { ja: '🖼 画像から生成', en: '🖼 From image' },
  genTitle: { ja: '画像からレリーフを生成', en: 'Generate relief from image' },
  genWidth: { ja: '幅（タワー数）', en: 'Width (towers)' },
  genMaxHeight: { ja: '最大高さ（段数）', en: 'Max height (pins)' },
  genInvert: { ja: '明暗を反転（暗いほど高い）', en: 'Invert (darker = taller)' },
  genEstimate: {
    ja: '生成予定: {cols}×{rows} 格子 / 約 {n} ピン',
    en: 'Output: {cols}×{rows} grid / ~{n} pins',
  },
  genTooMany: {
    ja: '⚠ ピン数が上限（{n}）を超えています。幅か高さを下げてください',
    en: '⚠ Exceeds the {n}-pin limit. Reduce width or height',
  },
  genGenerate: { ja: '生成', en: 'Generate' },
  genCancel: { ja: 'キャンセル', en: 'Cancel' },

  // パレット色名（表示用。データ上の正準名は palette.ts）
  colorBlue: { ja: 'ブルー', en: 'Blue' },
  colorWhite: { ja: 'ホワイト', en: 'White' },
  colorWarmgray: { ja: 'ウォームグレー', en: 'Warm gray' },

  // ダイアログ
  confirmDeleteSubtree: {
    ja: '子ピンを含むサブツリー全体を削除します。よろしいですか？',
    en: 'This deletes the whole subtree including child pins. Continue?',
  },
  loadFailed: { ja: '読み込みに失敗しました:', en: 'Failed to load:' },
  confirmReplace: {
    ja: '現在のモデル（{n} ピン）を破棄して読み込みます。よろしいですか？',
    en: 'Discard the current model ({n} pins) and load the file?',
  },
  confirmRestore: {
    ja: '前回の作業バックアップ（{n} ピン）が見つかりました。復元しますか？',
    en: 'Found a backup from your last session ({n} pins). Restore it?',
  },
} satisfies Record<string, Record<Lang, string>>

export type MessageKey = keyof typeof MESSAGES

export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text: string = MESSAGES[key][lang]
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

/** パレット色 id → 表示名キー（辞書に無い色は id をそのまま表示する） */
export const COLOR_NAME_KEYS: Record<string, MessageKey> = {
  blue: 'colorBlue',
  white: 'colorWhite',
  warmgray: 'colorWarmgray',
}
