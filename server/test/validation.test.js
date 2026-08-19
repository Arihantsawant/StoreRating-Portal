import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword, validateUser } from '../src/validation.js';

test('rejects malformed user bodies without throwing', () => {
  assert.deepEqual(validateUser(null), {
    name: 'Name must be 20 to 60 characters.',
    email: 'Enter a valid email address.',
    password: 'Password must be 8-16 characters and include an uppercase letter and a special character.'
  });
  assert.deepEqual(validateUser('invalid'), {
    name: 'Name must be 20 to 60 characters.',
    email: 'Enter a valid email address.',
    password: 'Password must be 8-16 characters and include an uppercase letter and a special character.'
  });
});

test('accepts a valid user and enforces password policy', () => {
  assert.deepEqual(validateUser({
    name: 'A Valid Registered Portal User',
    email: 'user@example.com',
    address: '1 Main Street',
    password: 'Valid@123'
  }), {});
  assert.equal(validatePassword('short'), false);
  assert.equal(validatePassword('Valid@123'), true);
});