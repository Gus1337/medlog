import { isIOS } from '../lib/standalone'
import { Button } from '../ui/primitives'

/**
 * Shown when MedLog is opened in a normal browser tab. Logging is blocked here
 * because data saved in a Safari tab does not carry over to the installed app.
 */
export function InstallScreen({ onContinueDev }: { onContinueDev?: () => void }) {
  const ios = isIOS()
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col px-6">
      <div className="animate-fade mt-10 flex flex-col items-center text-center">
        <img src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" className="h-20 w-20 rounded-[22px] shadow-md" />
        <h1 className="mt-6 text-2xl font-semibold">Add MedLog to your Home Screen</h1>
        <p className="mt-3 text-muted">
          MedLog keeps everything on this phone. It works as an app from your Home Screen, offline and without an
          account.
        </p>
      </div>

      <ol className="animate-fade mt-8 space-y-4">
        {(ios
          ? [
              ['Open this page in Safari', 'Other browsers can add to the Home Screen too, but Safari is the most reliable.'],
              ['Tap the Share button', 'The square with an arrow pointing up, at the bottom of the screen (or the top on some layouts).'],
              ['Choose “Add to Home Screen”', 'Scroll down the share options if you don’t see it. Keep “Open as Web App” switched on.'],
              ['Open MedLog from your Home Screen', 'Start logging there. You can close this tab.'],
            ]
          : [
              ['Open this page on your iPhone in Safari', 'MedLog is designed for iPhone.'],
              ['Share → “Add to Home Screen”', 'Then open MedLog from the Home Screen icon.'],
            ]
        ).map(([title, detail], i) => (
          <li key={i} className="flex gap-4 rounded-3xl bg-surface p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-[15px] text-muted">{detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 rounded-3xl bg-surface-2 p-4 text-[15px] text-muted">
        Why not log here? Safari keeps a browser tab’s storage separate from the installed app, so anything saved in this
        tab would not appear in MedLog on your Home Screen.
      </p>

      {onContinueDev && (
        <Button className="mt-6" onClick={onContinueDev}>
          Continue in browser (development only)
        </Button>
      )}
    </main>
  )
}
