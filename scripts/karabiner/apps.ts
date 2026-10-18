// Remote apps that operate JIS Windows. Edit this file to add an app or change its IME method.

import { toKey, type ToEvent } from 'karabiner.ts'

/**
 * How a tap on Command toggles the Windows IME.
 * - hotkey: left = Ctrl+Shift+F11 (IME off), right = Ctrl+Shift+F12 (IME on), handled by
 *           Eisu Kana (windows/eisu-kana) on Windows. Keep in sync with its main.go.
 * - lang:   left = japanese_eisuu, right = japanese_kana (no Windows app needed, but none of
 *           the current remote paths deliver them as IME off / on)
 */
export type ImeMethod = 'hotkey' | 'lang'

export const IME_KEYS: Record<ImeMethod, { left: ToEvent; right: ToEvent }> = {
  hotkey: {
    left: toKey('f11', ['left_control', 'left_shift']),
    right: toKey('f12', ['left_control', 'left_shift']),
  },
  lang: { left: toKey('japanese_eisuu'), right: toKey('japanese_kana') },
}

export interface RemoteApp {
  name: string
  bundleIds: RegExp[]
  ime: ImeMethod
  /** Convert US layout input into JIS key codes. */
  usToJis: boolean
}

// None of the remote paths deliver japanese_eisuu / japanese_kana as IME off / on
// (Splashtop even types a backquote), and Openterface turns F13 / F14 into
// Print Screen / App, so all of them use hotkey (standard keys only).
export const REMOTE_APPS: RemoteApp[] = [
  {
    name: 'Splashtop',
    bundleIds: [/^com\.splashtop\.stb\.macosx$/],
    ime: 'hotkey',
    usToJis: false,
  },
  {
    name: 'Parallels',
    bundleIds: [/^com\.parallels\.desktop/, /^com\.parallels\.vm/, /^com\.parallels\.winapp\./],
    ime: 'hotkey',
    usToJis: false,
  },
  {
    name: 'Openterface',
    // Set the Openterface app's keyboard mode to Mac. Its Windows / Linux modes remap
    // Cmd→Ctrl and Control→Win on top of these rules.
    bundleIds: [/^com\.openterface\.macOS$/],
    ime: 'hotkey',
    usToJis: true,
  },
]
