export type {
  User,
  UserRole,
  ProcessingRole,
  NamedRef,
  Supplier,
  Employee,
  Admin,
  Driver,
  Client,
  AdminUserProfile,
  AdminUserListItem,
  UserDetail,
  ProfileUpdatePayload,
} from './model/types';
export { USER_ROLE_LABELS, PROCESSING_ROLE_LABELS, PROCESSING_ROLES } from './model/constants';
export {
  PLACEHOLDER_CLIENT_NAME,
  INCOMPLETE_PROFILE_DISPLAY_NAME,
  UNSPECIFIED_CONTACT,
  FALLBACK_DISPLAY_NAME,
  isIncompleteClientName,
  getClientDisplayName,
  normalizeContactPhone,
  resolveDisplayName,
  getUserDisplayName,
} from './model/display-name';
export { getProfile, updateProfile, changePassword, initiateEmailChange, confirmEmailChange, getSuppliers, uploadAvatar } from './api/profile-api';
