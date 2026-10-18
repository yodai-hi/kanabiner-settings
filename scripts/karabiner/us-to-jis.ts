// Key codes to send so that US layout input types the same character on JIS Windows.

import type { FromKeyParam, ToKeyParam } from 'karabiner.ts'

// [US key, US with shift, JIS key to send, send with shift, character]
export type JisMapping = [FromKeyParam, boolean, ToKeyParam, boolean, string]

export const US_TO_JIS: JisMapping[] = [
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
