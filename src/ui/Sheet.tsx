import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const SheetCloseContext = createContext<() => void>(() => {})

/** Closes the surrounding sheet with its exit animation. */
export const useCloseSheet = () => useContext(SheetCloseContext)

/**
 * A tall bottom sheet with Cancel / title / primary action in a sticky header,
 * so the action stays reachable above the iOS keyboard.
 */
export function Sheet({
  title,
  onClose,
  actionLabel,
  onAction,
  actionDisabled,
  children,
}: {
  title: string
  onClose: () => void
  actionLabel?: string
  /** Runs the primary action; the sheet closes unless it returns false. */
  onAction?: () => unknown
  actionDisabled?: boolean
  children: ReactNode
}) {
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const close = () => {
    setClosing(true)
    setTimeout(onClose, 260)
  }

  const act = async () => {
    if (!onAction || busy) return
    setBusy(true)
    try {
      if ((await onAction()) !== false) close()
    } finally {
      setBusy(false)
    }
  }

  // Rendered at the end of <body>: an animated (transformed) ancestor would
  // otherwise become the reference for `position: fixed`.
  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`animate-backdrop absolute inset-0 bg-black/25 transition-opacity duration-300 ${closing ? 'opacity-0' : ''}`}
        onClick={close}
      />
      <div
        className={`animate-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-[28px] bg-bg shadow-2xl transition-transform duration-300 ease-calm ${
          closing ? 'translate-y-full' : ''
        }`}
        style={{ top: 'calc(max(env(safe-area-inset-top), 12px) + 12px)' }}
      >
        <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <button type="button" onClick={close} className="min-h-11 min-w-18 rounded-2xl px-3 text-left text-muted">
            Cancel
          </button>
          <h2 className="truncate text-[17px] font-semibold">{title}</h2>
          <div className="flex min-w-18 justify-end">
            {actionLabel && (
              <button
                type="button"
                onClick={act}
                disabled={actionDisabled || busy}
                className="min-h-11 rounded-2xl bg-accent px-4 font-semibold text-accent-ink transition-opacity duration-300 disabled:opacity-40"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),24px)]">
          <SheetCloseContext value={close}>{children}</SheetCloseContext>
        </div>
      </div>
    </div>,
    document.body,
  )
}
