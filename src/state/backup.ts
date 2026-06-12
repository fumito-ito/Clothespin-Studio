// localStorage への作業中バックアップ（FR-IO7, docs/03 §6）。
// 起動時に復元を提案し、以後 pins の変更を 1 秒デバウンスで保存する。外部送信なし（NFR-10）。

import { parseProject, serializeProject } from '../io/project'
import { DEFAULT_PALETTE } from '../assets/palette'
import { useStudio } from './store'
import { t } from '../i18n'

const KEY = 'clothespin-studio.backup'
let initialized = false // StrictMode の二重実行ガード

export function initBackup() {
  if (initialized) return
  initialized = true

  try {
    const raw = localStorage.getItem(KEY)
    if (raw && useStudio.getState().pins.length === 0) {
      const { project, errors } = parseProject(raw)
      if (errors.length === 0 && project && project.pins.length > 0) {
        if (window.confirm(t('confirmRestore', { n: project.pins.length }))) {
          useStudio.setState({ pins: project.pins })
          useStudio.temporal.getState().clear()
        }
      }
    }
  } catch {
    // localStorage が使えない環境では何もしない
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let lastPins = useStudio.getState().pins
  useStudio.subscribe((state) => {
    if (state.pins === lastPins) return
    lastPins = state.pins
    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(serializeProject(state.pins, DEFAULT_PALETTE)))
      } catch {
        // 容量超過などはベストエフォートで無視
      }
    }, 1000)
  })
}
