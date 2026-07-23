// Role Enums
export const RoleEnum = Object.freeze({
  USER: 'user',
  HOSPITAL_ADMIN: 'hospital_admin',
  POLICE: 'police',
  RESCUE_PERSON: 'rescue_person',
  SYSTEM_ADMIN: 'system_admin',
});

// Status Enums
export const StatusEnum = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BLOCKED: 'blocked',
});

// SOS Enums
export const SOSEnum = Object.freeze({
  STANDARD: 'standard',
  SILENT: 'silent',
  ACTIVE: 'active',
  DISPATCHED: 'dispatched',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
});
