// Remote apps that operate JIS Windows. Edit this file to add an app or change its IME method.

import type { ToKeyParam } from 'karabiner.ts'

/**
 * How a tap on Command toggles the Windows IME.
 * - lang:    left = japanese_eisuu (IME off), right = japanese_kana (IME on)
 * - homeend: left = home, right = end (needs windows/ime-toggle.ahk)
 */
export type ImeMethod = 'lang' | 'homeend'

export const IME_KEYS: Record<ImeMethod, { left: ToKeyParam; right: ToKeyParam }> = {
  lang: { left: 'japanese_eisuu', right: 'japanese_kana' },
  homeend: { left: 'home', right: 'end' },
}

export interface RemoteApp {
  name: string
  bundleIds: RegExp[]
  ime: ImeMethod
  /** Convert US layout input into JIS key codes. */
  usToJis: boolean
}

export const REMOTE_APPS: RemoteApp[] = [
  {
    name: 'Splashtop',
    bundleIds: [/^com\.splashtop\.stb\.macosx$/],
    ime: 'lang',
    usToJis: false,
  },
  {
    name: 'Parallels',
    bundleIds: [/^com\.parallels\.desktop/, /^com\.parallels\.vm/, /^com\.parallels\.winapp\./],
    ime: 'lang',
    usToJis: false,
  },
  {
    name: 'Openterface',
    bundleIds: [/^com\.openterface\.macOS$/],
    ime: 'lang',
    usToJis: true,
  },
]
