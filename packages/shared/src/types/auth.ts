// Authentication types for Cluebase AI

import type { UserProfile, Workspace, WorkspaceMember } from './workspaces.js';

// Auth session from Supabase
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  phone: string | null;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  app_metadata: {
    provider?: string;
    providers?: string[];
  };
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

// API request/response types

export interface SignUpRequest {
  email: string;
  password: string;
  full_name?: string;
  workspace_name?: string; // Creates workspace on signup
  invite_token?: string; // If joining existing workspace
}

export interface SignUpResponse {
  user: AuthUser;
  session: AuthSession;
  profile: UserProfile;
  workspace?: Workspace;
  membership?: WorkspaceMember;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse {
  user: AuthUser;
  session: AuthSession;
  profile: UserProfile;
  workspaces: WorkspaceWithRole[];
}

export interface WorkspaceWithRole {
  workspace: Workspace;
  role: WorkspaceMember['role'];
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface UpdatePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UpdatePasswordResponse {
  message: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  avatar_url?: string | null;
  preferences?: Partial<UserProfile['preferences']>;
  default_workspace_id?: string | null;
}

export interface UpdateProfileResponse {
  profile: UserProfile;
}

// OAuth types
export type OAuthProvider = 'google' | 'github' | 'slack';

export interface OAuthSignInRequest {
  provider: OAuthProvider;
  redirect_to?: string;
  invite_token?: string;
}

export interface OAuthSignInResponse {
  url: string;
}

// Token refresh
export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  session: AuthSession;
}

// Authenticated request context (attached to req by middleware)
export interface AuthContext {
  user: AuthUser;
  profile: UserProfile;
  session: AuthSession;
}

// Full request context with workspace
export interface RequestContext extends AuthContext {
  workspace: Workspace;
  membership: WorkspaceMember;
}
