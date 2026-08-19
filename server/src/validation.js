const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const password = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}$/;
export const clean = value => typeof value === 'string' ? value.trim() : '';
export function validateUser(input = {}, requirePassword = true) {
  const { name, email: mail, address, password: pass } = input && typeof input === 'object' ? input : {};
  const errors = {};
  if (clean(name).length < 20 || clean(name).length > 60) errors.name = 'Name must be 20 to 60 characters.';
  if (!email.test(clean(mail))) errors.email = 'Enter a valid email address.';
  if (clean(address).length > 400) errors.address = 'Address must be at most 400 characters.';
  if (requirePassword && !password.test(pass || '')) errors.password = 'Password must be 8-16 characters and include an uppercase letter and a special character.';
  return errors;
}
export const validatePassword = value => password.test(value || '');
