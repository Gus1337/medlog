import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'soft' | 'ghost' | 'quiet-danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink',
  soft: 'bg-surface-2 text-ink',
  ghost: 'bg-transparent text-accent',
  'quiet-danger': 'bg-surface-2 text-bad',
}

export function Button({
  variant = 'soft',
  icon,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 font-medium transition-[opacity,transform,background-color] duration-300 active:scale-[0.98] active:opacity-80 disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors duration-300 active:bg-surface-2 ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${className}`}>{children}</section>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between px-1">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  )
}

/** Explains what will appear in a place that is still empty. */
export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: IconName }) {
  return (
    <div className="animate-fade flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-8 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name={icon} />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-[15px] text-muted">{children}</p>}
    </div>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  colour,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  /** CSS colour for the selected state, e.g. a medication colour. */
  colour?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={selected && colour ? { backgroundColor: colour, borderColor: colour } : undefined}
      className={`min-h-11 rounded-full border px-4 text-[15px] transition-colors duration-300 ${
        selected ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 rounded-xl px-2 text-[15px] transition-all duration-300 ${
            value === o.value ? 'bg-surface font-medium text-ink shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-faint">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full min-h-11 rounded-2xl border border-line bg-surface px-4 py-2.5 outline-none transition-colors duration-300 focus:border-accent'
