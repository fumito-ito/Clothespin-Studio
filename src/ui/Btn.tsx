// パネル共通の小型ボタン

import type { CSSProperties, ReactNode } from 'react'

const buttonStyle: CSSProperties = {
  background: '#262b34',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 12,
}

export function Btn({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      // active を持つボタンはトグル扱いとして押下状態を支援技術へ伝える
      aria-pressed={active}
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
