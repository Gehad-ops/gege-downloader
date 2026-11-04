import { spawn, type ChildProcess } from 'node:child_process'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

export interface LegendaryStatus {
  logged_in: boolean
  username?: string
  version?: string
  [key: string]: unknown
}

export interface LegendaryGame {
  app_name: string
  title: string
  app_version?: string
  installed?: boolean
  install_size?: number
  [key: string]: unknown
}

export function legendaryBinary(): string {
  const base = app.isPackaged
    ? join(process.resourcesPath, 'legendary')
    : join(__dirname, '../../resources/legendary')
  return join(base, 'legendary.exe')
}

export function legendaryConfigDir(): string {
  const dir = join(app.getPath('userData'), 'legendary')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function runLegendary(args: string[], opts: { onLine?: (line: string) => void; env?: NodeJS.ProcessEnv } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn(legendaryBinary(), args, {
      env: { ...process.env, XDG_CONFIG_HOME: legendaryConfigDir(), ...opts.env },
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (b: Buffer) => {
      const s = b.toString()
      stdout += s
      s.split(/\r?\n/).forEach((l) => { if (l.trim() && opts.onLine) opts.onLine(l) })
    })
    child.stderr?.on('data', (b: Buffer) => { stderr += b.toString() })
    child.on('error', (e) => resolve({ code: -1, stdout, stderr: stderr + e.message }))
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

export async function legendaryStatus(): Promise<LegendaryStatus | null> {
  const r = await runLegendary(['status', '--json'])
  if (r.code !== 0) return null
  try { return JSON.parse(r.stdout) as LegendaryStatus } catch { return null }
}

export async function legendaryList(): Promise<LegendaryGame[]> {
  const r = await runLegendary(['list', '--json'])
  if (r.code !== 0) return []
  try {
    const parsed = JSON.parse(r.stdout)
    return Array.isArray(parsed) ? parsed : (parsed.games ?? [])
  } catch { return [] }
}

export async function legendaryInstalled(): Promise<LegendaryGame[]> {
  const r = await runLegendary(['list-installed', '--json'])
  if (r.code !== 0) return []
  try {
    const parsed = JSON.parse(r.stdout)
    return Array.isArray(parsed) ? parsed : (parsed.games ?? [])
  } catch { return [] }
}

export async function legendaryLogout(): Promise<void> {
  await runLegendary(['auth', '--delete'])
}

export async function legendaryAuthCode(code: string): Promise<{ ok: boolean; stderr: string }> {
  const r = await runLegendary(['auth', '--code', code])
  return { ok: r.code === 0, stderr: r.stderr }
}

export async function legendaryAuthUrl(): Promise<string | null> {
  // Spawn auth --disable-webview and capture the URL line.
  return new Promise((resolve) => {
    const child = spawn(legendaryBinary(), ['auth', '--disable-webview'], {
      env: { ...process.env, XDG_CONFIG_HOME: legendaryConfigDir() },
      windowsHide: true,
    })
    let found: string | null = null
    child.stdout?.on('data', (b: Buffer) => {
      const s = b.toString()
      const m = s.match(/https?:\/\/\S+/)
      if (m && !found) { found = m[0]; child.kill(); resolve(found) }
    })
    child.stderr?.on('data', () => {})
    child.on('close', () => { if (!found) resolve(null) })
    setTimeout(() => { if (!found) { child.kill(); resolve(null) } }, 15000)
  })
}

export async function legendaryInstall(appName: string, onLine?: (l: string) => void): Promise<number> {
  const r = await runLegendary(['install', appName, '--yes'], { onLine })
  return r.code
}

export async function legendaryUninstall(appName: string): Promise<number> {
  const r = await runLegendary(['uninstall', appName, '--yes'])
  return r.code
}

export async function legendaryLaunch(appName: string): Promise<number> {
  const r = await runLegendary(['launch', appName, '--dry-run', '--json'])
  // dry-run only prints; real launch would block. For now return code.
  return r.code
}