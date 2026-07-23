// Role enums (mirrors server-side)
export const RoleEnum = Object.freeze({
  USER: 'user',
  HOSPITAL_ADMIN: 'hospital_admin',
  POLICE: 'police',
  RESCUE_PERSON: 'rescue_person',
  SYSTEM_ADMIN: 'system_admin',
});

export const StatusEnum = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BLOCKED: 'blocked',
});
