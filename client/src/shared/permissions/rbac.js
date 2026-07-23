import { ROLES } from '../constants/roles.js';

/**
 * Check if user has one of the allowed roles
 * @param {object} user
 * @param {string[]} allowedRoles
 */
export const hasRole = (user, ...allowedRoles) => {
  if (!user) return false;
  return allowedRoles.includes(user.role);
};

export const isAdmin = (user) => hasRole(user, ROLES.SYSTEM_ADMIN);
export const isHospital = (user) => hasRole(user, ROLES.HOSPITAL_ADMIN);
export const isDispatcher = (user) => hasRole(user, ROLES.POLICE, ROLES.RESCUE_PERSON);
export const isCitizen = (user) => hasRole(user, ROLES.USER);
