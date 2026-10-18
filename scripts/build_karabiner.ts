// Generates the Karabiner-Elements rules for operating JIS Windows from a US keyboard.
//
//   bun scripts/build_karabiner.ts             # write the asset and apply it to the profile
//   bun scripts/build_karabiner.ts --no-apply  # write the asset only
//   bun scripts/build_karabiner.ts --dry-run   # write the asset, print the profile instead of applying
//
// Output: karabiner/assets/complex_modifications/remote-windows.json
//
// Remote apps: scripts/karabiner/apps.ts
// US -> JIS table: scripts/karabiner/us-to-jis.ts
// Rule definitions: scripts/karabiner/rules.ts

import { join } from 'node:path'
import { writeToProfile } from 'karabiner.ts'
import { capsLockRule, remoteWindowsRules } from './karabiner/rules'

const PROFILE = 'Default profile'
const ROOT = join(import.meta.dir, '..')
const ASSET = join(ROOT, 'karabiner/assets/complex_modifications/remote-windows.json')
const KARABINER_JSON = join(ROOT, 'karabiner/karabiner.json')

const remoteRules = remoteWindowsRules()
const asset = {
  title: 'リモート Windows（JIS）',
  rules: remoteRules,
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
