const CODE_PREFIX = 'DA';
const CODE_LENGTH = 5;
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChar(): string {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)] ?? 'A';
}

export function generateFriendCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += randomChar();
  }
  return `${CODE_PREFIX}-${code}`;
}

export function validateFriendCode(code: string): boolean {
  const regex = new RegExp(`^${CODE_PREFIX}-[${CHARSET}]{${CODE_LENGTH}}$`);
  return regex.test(code);
}

export function isValidFriendCodeFormat(code: string): boolean {
  return validateFriendCode(code);
}
