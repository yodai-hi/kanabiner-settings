// Generates the Karabiner-Elements rules for operating JIS Windows from a US keyboard.
//
//   bun scripts/build_karabiner.ts             # write the asset and apply it to the profile
//   bun scripts/build_karabiner.ts --no-apply  # write the asset only
//   bun scripts/build_karabiner.ts --dry-run   # write the asset, print the profile instead of applying
//
// Output: karabiner/assets/complex_modifications/remote-windows.json

import { join } from 'node:path'
import {
  ifApp,
  map,
  rule,
  writeToProfile,
  type FromKeyParam,
  type Rule,
  type ToKeyParam,
} from 'karabiner.ts'

const PROFILE = 'Default profile'
const ROOT = join(import.meta.dir, '..')
const ASSET = join(ROOT, 'karabiner/assets/complex_modifications/remote-windows.json')
const KARABINER_JSON = join(ROOT, 'karabiner/karabiner.json')

// ---------------------------------------------------------------------------
// Remote apps
// ---------------------------------------------------------------------------

/**
 * How a tap on Command toggles the Windows IME.
 * - lang:    left = japanese_eisuu (IME off), right = japanese_kana (IME on)
 * - homeend: left = home, right = end (needs windows/ime-toggle.ahk)
 */
type ImeMethod = 'lang' | 'homeend'

interface RemoteApp {
  name: string
  bundleIds: RegExp[]
  ime: ImeMethod
  /** Convert US layout input into JIS key codes. */
  usToJis: boolean
}

const REMOTE_APPS: RemoteApp[] = [
  {
    name: 'Splashtop',
    bundleIds: [/^com\.splashtop\.stb\.macosx$/],
    ime: 'homeend',
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

const IME_KEYS: Record<ImeMethod, { left: ToKeyParam; right: ToKeyParam }> = {
  lang: { left: 'japanese_eisuu', right: 'japanese_kana' },
  homeend: { left: 'home', right: 'end' },
}

// ---------------------------------------------------------------------------
// US -> JIS table
// ---------------------------------------------------------------------------

// [US key, US with shift, JIS key to send, send with shift, character]
type JisMapping = [FromKeyParam, boolean, ToKeyParam, boolean, string]

const US_TO_JIS: JisMapping[] = [
  ['2', true, 'open_bracket', false, '@'],
  ['6', true, 'equal_sign', false, '^'],
  ['7', true, '6', true, '&'],
  ['8', true, 'quote', true, '*'],
  ['9', true, '8', true, '('],
  ['0', true, '9', true, ')'],
  ['hyphen', true, 'international1', true, '_'],
  ['equal_sign', false, 'hyphen', true, '='],
  ['equal_sign', true, 'semicolon', true, '+'],
  ['open_bracket', false, 'close_bracket', false, '['],
  ['open_bracket', true, 'close_bracket', true, '{'],
  ['close_bracket', false, 'non_us_pound', false, ']'],
  ['close_bracket', true, 'non_us_pound', true, '}'],
  ['backslash', false, 'international1', false, '\\'],
  ['backslash', true, 'international3', true, '|'],
  ['semicolon', true, 'quote', false, ':'],
  ['quote', false, '7', true, "'"],
  ['quote', true, '2', true, '"'],
  ['grave_accent_and_tilde', false, 'open_bracket', true, '`'],
  ['grave_accent_and_tilde', true, 'equal_sign', true, '~'],
]

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

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

const capsLockRule = rule('Caps Lock: Shift+Caps Lock shortcuts').manipulators([
  map('caps_lock', 'left_shift', 'any').to('page_down'),
  map('caps_lock', 'right_shift', 'any').to({
    apple_vendor_keyboard_key_code: 'mission_control',
    modifiers: ['left_command'],
  }),
])

function remoteWindowsRules() {
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

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const remoteRules = remoteWindowsRules()
const asset = {
  title: 'Remote Windows (JIS) from US keyboard',
  rules: remoteRules.map((r): Rule => r.build()),
}
await Bun.write(ASSET, JSON.stringify(asset, null, 2) + '\n')
console.log(`✓ Wrote ${ASSET}`)

if (!process.argv.includes('--no-apply')) {
  const dryRun = process.argv.includes('--dry-run')
  writeToProfile({ name: PROFILE, dryRun, karabinerJsonPath: KARABINER_JSON }, [
    ...remoteRules,
    capsLockRule,
  ])
}
