import { exec } from 'node:child_process'
import { app } from 'electron'
import type { WhenQueueFinishes } from '../shared/types'

/** Does what the user asked once every download has finished. `quit` closes Plexo; the others ask
 * the OS to sleep or shut down, best-effort — one that fails (a container, a locked session)
 * only logs, leaving Plexo open. */
export function performQueueAction(action: Exclude<WhenQueueFinishes, 'none'>): void {
  if (action === 'quit') {
    app.quit()
    return
  }
  const command =
    process.platform === 'win32'
      ? action === 'shutdown'
        ? 'shutdown /s /t 0'
        : 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'
      : process.platform === 'darwin'
        ? action === 'shutdown'
          ? 'osascript -e \'tell app "System Events" to shut down\''
          : 'pmset sleepnow'
        : action === 'shutdown'
          ? 'systemctl poweroff'
          : 'systemctl suspend'
  exec(command, (error) => {
    if (error) console.error(`[plexo] could not ${action} the computer`, error)
  })
}
