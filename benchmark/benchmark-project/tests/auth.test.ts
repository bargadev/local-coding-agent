import { describe, it, expect } from 'vitest';
import { validateEmail, hashPassword, verifyPassword, login } from '../src/auth/service.js';

describe('validateEmail', () => {
  it('accepts valid email', () => expect(validateEmail('user@example.com')).toBe(true));
  it('rejects invalid email', () => expect(validateEmail('notanemail')).toBe(false));
});

describe('login', () => {
  const hash = hashPassword('secret123');

  it('succeeds with correct credentials', () => {
    expect(login('user@example.com', 'secret123', hash).success).toBe(true);
  });

  it('fails with wrong password', () => {
    expect(login('user@example.com', 'wrong', hash).success).toBe(false);
  });

  // T10: this test should pass after the bug fix
  it('succeeds with uppercase email', () => {
    expect(login('User@Example.COM', 'secret123', hash).success).toBe(true);
  });
});
