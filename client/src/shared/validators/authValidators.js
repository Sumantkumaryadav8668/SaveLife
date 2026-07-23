/**
 * Auth form validators
 */

export const validateEmail = (email) => {
  if (!email) return 'Email is required';
  if (!/\S+@\S+\.\S+/.test(email)) return 'Enter a valid email address';
  return null;
};

export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Minimum 6 characters';
  return null;
};

export const validatePhone = (phone) => {
  if (!phone) return 'Phone number is required';
  if (!/^[+]?[0-9\s\-]{8,15}$/.test(phone)) return 'Enter a valid phone number';
  return null;
};
