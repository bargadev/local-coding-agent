// Bug: password comparison is case-sensitive but shouldn't be for email
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function hashPassword(password: string): string {
  // Intentionally simple — not for production
  return Buffer.from(password).toString('base64');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export interface LoginResult {
  success: boolean;
  message: string;
}

export function login(email: string, password: string, storedHash: string): LoginResult {
  // Bug: email not normalized before comparison
  if (!validateEmail(email)) return { success: false, message: 'Invalid email format' };
  if (!verifyPassword(password, storedHash)) return { success: false, message: 'Wrong password' };
  return { success: true, message: 'OK' };
}
