import { ifApp, map, rule, type ToEvent } from 'karabiner.ts'
import { IME_KEYS, REMOTE_APPS, type ImeMethod, type RemoteApp } from './apps'
import { US_TO_JIS } from './us-to-jis'

const names = (apps: RemoteApp[]) => apps.map((a) => a.name).join(', ')

function usToJisRule(apps: RemoteApp[]) {
  return rule(`Remote Windows: US → JIS (${names(apps)})`, ifApp(apps.flatMap((a) => a.bundleIds)))
    .manipulators(
      US_TO_JIS.map(([from, fromShift, to, toShift]) =>
        map(from, fromShift ? 'shift' : '', 'caps_lock').to(to, toShift ? 'left_shift' : []),
      ),
    )
}

function remoteModifierRule(ime: ImeMethod, apps: RemoteApp[]) {
  const keys = IME_KEYS[ime]
  return rule(
    `Remote Windows (${ime}: ${names(apps)}): Ctrl→Ctrl, Opt→Alt, Cmd held=Ctrl / tapped=${keys.left}/${keys.right}. No Win key.`,
    ifApp(apps.flatMap((a) => a.bundleIds)),
  ).manipulators([
    map('left_control', '', 'any').to('left_control'),
    map('right_control', '', 'any').to('right_control'),
    map('left_command', '', 'any').to('left_control', [], { lazy: true }).toIfAlone(keys.left),
    map('right_command', '', 'any').to('right_control', [], { lazy: true }).toIfAlone(keys.right),
    map('left_option', '', 'any').to('left_option'),
    map('right_option', '', 'any').to('right_option'),
  ])
}

const localMacRule = rule(
  'Local Mac: Ctrl→Cmd, Opt→Ctrl, Cmd→Opt (tapped: eisuu/kana)',
).manipulators([
  map('left_control', '', 'any').to('left_command').toIfAlone('left_command'),
  map('left_option', '', 'any').to('left_control').toIfAlone('left_control'),
  map('right_option', '', 'any').to('right_control').toIfAlone('right_control'),
  map('left_command', '', 'any').to('left_option').toIfAlone('japanese_eisuu'),
  map('right_command', '', 'any').to('right_option').toIfAlone('japanese_kana'),
])

/** Rules written to remote-windows.json. */
export function remoteWindowsRules() {
  const rules = []
  const jisApps = REMOTE_APPS.filter((a) => a.usToJis)
  if (jisApps.length) rules.push(usToJisRule(jisApps))
  for (const ime of Object.keys(IME_KEYS) as ImeMethod[]) {
    const apps = REMOTE_APPS.filter((a) => a.ime === ime)
    if (apps.length) rules.push(remoteModifierRule(ime, apps))
  }
  // Must come after the remote rules, which take precedence because they have conditions.
  rules.push(localMacRule)
  return rules
}

export const capsLockRule = rule('Caps Lock: Shift+Caps Lock shortcuts').manipulators([
  map('caps_lock', 'left_shift', 'any').to('page_down'),
  // apple_vendor_keyboard_key_code is valid in Karabiner but missing from karabiner.ts types.
  map('caps_lock', 'right_shift', 'any').to({
    apple_vendor_keyboard_key_code: 'mission_control',
    modifiers: ['left_command'],
  } as unknown as ToEvent),
])
