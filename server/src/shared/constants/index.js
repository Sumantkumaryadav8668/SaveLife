// Application-wide constants

export const APP_NAME = 'LifeSave – SDEC';
export const APP_VERSION = '1.0.0';

export const ROLES = {
  USER: 'user',
  HOSPITAL_ADMIN: 'hospital_admin',
  POLICE: 'police',
  RESCUE_PERSON: 'rescue_person',
  SYSTEM_ADMIN: 'system_admin',
};

export const SOS_STATUS = {
  ACTIVE: 'active',
  DISPATCHED: 'dispatched',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
};

export const ENTITY_TYPES = {
  HOSPITAL: 'hospital',
  POLICE: 'police',
  RESCUE: 'rescue',
};

export const NOTIFICATION_TYPES = {
  SOS_ALERT: 'sos_alert',
  SOS_UPDATE: 'sos_update',
  SOS_RESOLVED: 'sos_resolved',
  SYSTEM: 'system',
  HOSPITAL: 'hospital',
  POLICE: 'police',
  RESCUE: 'rescue',
  GENERAL: 'general',
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};
