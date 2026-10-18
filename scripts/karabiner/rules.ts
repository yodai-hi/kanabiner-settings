import { ifApp, map, rule, type RuleBuilder, type Rule, type ToEvent } from 'karabiner.ts'
import { IME_KEYS, REMOTE_APPS, type ImeMethod, type RemoteApp } from './apps'
import { US_TO_JIS } from './us-to-jis'

// Karabiner shows description_notes under the rule title, but karabiner.ts has no API for it.
type NotedRule = Rule & { description_notes: string[] }

const withNotes = (builder: RuleBuilder, notes: string[]): NotedRule => ({
  ...builder.build(),
  description_notes: notes,
})

const names = (apps: RemoteApp[]) => apps.map((a) => a.name).join(', ')

function usToJisRule(apps: RemoteApp[]) {
  const builder = rule('リモート: US→JIS 記号変換', ifApp(apps.flatMap((a) => a.bundleIds)))
    .manipulators(
      US_TO_JIS.map(([from, fromShift, to, toShift]) =>
        map(from, fromShift ? 'shift' : '', 'caps_lock').to(to, toShift ? 'left_shift' : []),
      ),
    )
  return withNotes(builder, [`対象: ${names(apps)}`, `${US_TO_JIS.map((m) => m[4]).join(' ')} を JIS 配列で入力`])
}

const IME_LABELS: Record<ImeMethod, { title: string; tap: string }> = {
  lang: { title: '英数/かな', tap: '左=英数 / 右=かな' },
  homeend: { title: 'Home/End', tap: '左=Home / 右=End（ime-toggle.ahk で IME 切替）' },
}

function remoteModifierRule(ime: ImeMethod, apps: RemoteApp[]) {
  const keys = IME_KEYS[ime]
  const label = IME_LABELS[ime]
  const builder = rule(`リモート: 修飾キー（${label.title}）`, ifApp(apps.flatMap((a) => a.bundleIds)))
    .manipulators([
      map('left_control', '', 'any').to('left_control'),
      map('right_control', '', 'any').to('right_control'),
      map('left_command', '', 'any').to('left_control', [], { lazy: true }).toIfAlone(keys.left),
      map('right_command', '', 'any').to('right_control', [], { lazy: true }).toIfAlone(keys.right),
      map('left_option', '', 'any').to('left_option'),
      map('right_option', '', 'any').to('right_option'),
    ])
  return withNotes(builder, [
    `対象: ${names(apps)}`,
    'Ctrl→Ctrl / Option→Alt / Win キーは送らない',
    `Cmd 長押し→Ctrl、単押し→${label.tap}`,
  ])
}

const localMacRule = withNotes(
  rule('Mac: 修飾キー入れ替え').manipulators([
    map('left_control', '', 'any').to('left_command').toIfAlone('left_command'),
    map('left_option', '', 'any').to('left_control').toIfAlone('left_control'),
    map('right_option', '', 'any').to('right_control').toIfAlone('right_control'),
    map('left_command', '', 'any').to('left_option').toIfAlone('japanese_eisuu'),
    map('right_command', '', 'any').to('right_option').toIfAlone('japanese_kana'),
  ]),
  ['左 Ctrl→Cmd / Option→Ctrl / Cmd→Option', 'Cmd 単押し→左=英数 / 右=かな'],
)

/** Rules written to remote-windows.json. */
export function remoteWindowsRules(): NotedRule[] {
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

export const capsLockRule = withNotes(
  rule('Caps Lock ショートカット').manipulators([
    map('caps_lock', 'left_shift', 'any').to('page_down'),
    // apple_vendor_keyboard_key_code is valid in Karabiner but missing from karabiner.ts types.
    map('caps_lock', 'right_shift', 'any').to({
      apple_vendor_keyboard_key_code: 'mission_control',
      modifiers: ['left_command'],
    } as unknown as ToEvent),
  ]),
  ['左 Shift+Caps Lock→Page Down', '右 Shift+Caps Lock→Mission Control'],
)
