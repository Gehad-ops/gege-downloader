import { useEffect, useState } from 'react'

export function EpicView(): React.JSX.Element {
  const [status, setStatus] = useState<{ loggedIn: boolean; username?: string } | null>(null)
  const [games, setGames] = useState<any[]>([])
  const [installed, setInstalled] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function refresh(): Promise<void> {
    try {
      const s = await window.gege.epicStatus()
      setStatus(s)
      if (s?.loggedIn) {
        setGames(await window.gege.epicList())
        setInstalled(await window.gege.epicInstalled())
      }
    } catch (e) {
      setMsg(String(e))
    }
  }

  useEffect(() => { void refresh() }, [])

  async function login(): Promise<void> {
    setBusy(true); setMsg('Opening Epic login window…')
    try {
      const r = await window.gege.epicLogin()
      setMsg(r.ok ? ('Logged in as ' + (r.username ?? '')) : ('Login failed: ' + (r.stderr ?? '')))
      await refresh()
    } finally { setBusy(false) }
  }

  async function logout(): Promise<void> {
    setBusy(true)
    try { await window.gege.epicLogout(); setMsg('Logged out'); await refresh() }
    finally { setBusy(false) }
  }

  async function install(name: string): Promise<void> {
    setBusy(true); setMsg('Installing ' + name + '…')
    try {
      const code = await window.gege.epicInstall(name)
      setMsg(code === 0 ? ('Installed ' + name) : ('Install failed (code ' + code + ')'))
      await refresh()
    } finally { setBusy(false) }
  }

  async function uninstall(name: string): Promise<void> {
    setBusy(true)
    try {
      const code = await window.gege.epicUninstall(name)
      setMsg(code === 0 ? ('Uninstalled ' + name) : ('Uninstall failed (code ' + code + ')'))
      await refresh()
    } finally { setBusy(false) }
  }

  async function launch(name: string): Promise<void> {
    setBusy(true)
    try { await window.gege.epicLaunch(name); setMsg('Launch requested for ' + name) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: 0 }}>Epic Games (via Legendary)</h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        {status?.loggedIn ? ('Logged in as ' + (status.username ?? 'unknown')) : 'Not logged in'}
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {!status?.loggedIn && <button disabled={busy} onClick={() => void login()}>Log in</button>}
        {status?.loggedIn && <button disabled={busy} onClick={() => void logout()}>Log out</button>}
        {status?.loggedIn && <button disabled={busy} onClick={() => void refresh()}>Refresh</button>}
      </div>
      {msg && <p style={{ color: 'var(--text-secondary)' }}>{msg}</p>}
      {status?.loggedIn && (
        <>
          <h3>Library ({games.length})</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {games.map((g: any) => {
              const isInstalled = installed.some((i: any) => i.app_name === g.app_name)
              return (
                <li key={g.app_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>{g.title ?? g.app_name}</span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    {isInstalled
                      ? <><button disabled={busy} onClick={() => void launch(g.app_name)}>Launch</button><button disabled={busy} onClick={() => void uninstall(g.app_name)}>Uninstall</button></>
                      : <button disabled={busy} onClick={() => void install(g.app_name)}>Install</button>}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 16 }}>
        Powered by <a href="https://github.com/derrod/legendary" target="_blank" rel="noreferrer">Legendary</a> (GPL-3.0). Legendary is an unofficial Epic Games Launcher replacement.
      </p>
    </div>
  )
}