// AWS Authentication and Connection Management
export { AWSCredentialManager } from './credential-manager';
export { AWSProfileReader } from './profile-reader';
export { AWSConnectionManager, type AWSConnectionManagerInterface } from './connection-manager';

// Re-export types for convenience
export type {
  AWSCredentials,
  ConnectionStatus,
  CredentialType,
  SSOConfig,
  ProfileConfig,
  RoleConfig,
  CredentialValidationResult,
  AWSProfile,
  CredentialChainOptions,
} from '../../shared/types';