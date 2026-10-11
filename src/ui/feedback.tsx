import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button } from './primitives'

interface Toast {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
}

interface ConfirmRequest {
  title: string
  message?: string
  confirmLabel: string
  resolve: (ok: boolean) => void
}

interface FeedbackApi {
  toast: (message: string, action?: Toast['action']) => void
  confirm: (opts: { title: string; message?: string; confirmLabel?: string }) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackApi>({
  toast: () => {},
  confirm: async () => false,
})

export const useFeedback = () => useContext(FeedbackContext)

/** Gentle toasts (with optional Undo) and a calm confirmation dialog. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((message: string, action?: Toast['action']) => {
    clearTimeout(timer.current)
    setToast({ id: Date.now(), message, action })
    timer.current = setTimeout(() => setToast(null), action ? 7000 : 3500)
  }, [])

  const confirm = useCallback(
    (opts: { title: string; message?: string; confirmLabel?: string }) =>
      new Promise<boolean>((resolve) =>
        setRequest({ title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel ?? 'OK', resolve }),
      ),
    [],
  )

  const answer = (ok: boolean) => {
    request?.resolve(ok)
    setRequest(null)
  }

  return (
    <FeedbackContext value={{ toast: showToast, confirm }}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="animate-fade fixed inset-x-4 z-50 flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-2 text-bg shadow-lg"
          style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 76px)' }}
        >
          <span className="py-2 text-[15px]">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="min-h-11 rounded-xl px-3 font-semibold text-accent-soft"
              onClick={() => {
                toast.action!.onClick()
                setToast(null)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
      {request && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="animate-backdrop absolute inset-0 bg-black/25" onClick={() => answer(false)} />
          <div className="animate-sheet relative mb-[env(safe-area-inset-bottom)] w-full max-w-md rounded-3xl bg-surface p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">{request.title}</h2>
            {request.message && <p className="mt-2 text-muted">{request.message}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button onClick={() => answer(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => answer(true)}>
                {request.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext>
  )
}
