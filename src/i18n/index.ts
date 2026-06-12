// 翻訳ユーティリティ。言語はストア（エディタ状態）に持ち、localStorage に永続化する。

import { useStudio } from '../state/store'
import { translate, type Lang, type MessageKey } from './messages'

export type { Lang, MessageKey }
export { COLOR_NAME_KEYS } from './messages'

/** React コンポーネント用: 現在言語の翻訳関数を返す（言語変更で再レンダー） */
export function useT() {
  const lang = useStudio((s) => s.lang)
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
}

/** 非 React 文脈（アクション・ダイアログ）用 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(useStudio.getState().lang, key, vars)
}
