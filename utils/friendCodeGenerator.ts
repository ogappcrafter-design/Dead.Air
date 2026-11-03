import {
  FRIEND_CODE_CHARSET,
  FRIEND_CODE_LENGTH,
  FRIEND_CODE_PATTERN,
  FRIEND_CODE_PREFIX,
} from '../lib/constants';

function randomChar(): string {
  return FRIEND_CODE_CHARSET[Math.floor(Math.random() * FRIEND_CODE_CHARSET.length)] ?? 'A';
}

export function generateFriendCode(): string {
  let code = '';
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    code += randomChar();
  }
  return `${FRIEND_CODE_PREFIX}-${code}`;
}

export function validateFriendCode(code: string): boolean {
  return FRIEND_CODE_PATTERN.test(code);
}

export function isValidFriendCodeFormat(code: string): boolean {
  return validateFriendCode(code);
}
