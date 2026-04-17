/**
 * OpenID Connect Provider Support
 * 
 * This service handles OIDC authentication including:
 * - Authorization code flow
 * - PKCE support
 * - Discovery document parsing
 * - Token validation and refresh
 * - UserInfo retrieval
 */

import { db } from '@/lib/db';
import crypto from 'crypto';

// OIDC Configuration types
export interface OIDCConfig {
  clientId: string;
  clientSecret: string;
  discoveryUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUrl?: string;
  scopes: string;
  usePkce: boolean;
}

export interface OIDCDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  end_session_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

export interface OIDCTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface OIDCUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: {
    formatted?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  updated_at?: number;
  [key: string]: unknown;
}

export interface PKCEChallenge {
  code_verifier: string;
  code_challenge: string;
  code_challenge_method: string;
}

export interface OIDCAuthParams {
  connectionId: string;
  tenantId: string;
  redirectUri: string;
  state?: string;
  nonce?: string;
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  maxAge?: number;
  loginHint?: string;
  acrValues?: string;
}

export class OIDCService {
  /**
   * SECURITY WARNING: This in-memory state store is suitable for development
   * and single-instance deployments only. In production with multiple server
   * instances or serverless functions, OIDC state will not be shared across
   * processes, causing authentication failures. A persistent store (Redis,
   * database table, etc.) should replace this Map for production use.
   */
  private static stateStore = new Map<string, {
    connectionId: string;
    codeVerifier?: string;
    redirectUri: string;
    expiresAt: Date;
  }>();

  /** Warn once at module load if running in production with in-memory state */
  private static _prodWarned = false;
  private static warnProduction() {
    if (process.env.NODE_ENV === 'production' && !this._prodWarned) {
      console.warn(
        '[SECURITY] OIDC state is stored in-memory. ' +
        'This will fail in multi-instance deployments. ' +
        'Migrate to a persistent store (Redis/DB) for production.'
      );
      this._prodWarned = true;
    }
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  static generatePKCE(): PKCEChallenge {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return {
      code_verifier: codeVerifier,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    };
  }

  /**
   * Generate state parameter for CSRF protection
   */
  static generateState(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Generate nonce for replay protection
   */
  static generateNonce(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Fetch OIDC discovery document
   */
  static async fetchDiscoveryDocument(discoveryUrl: string): Promise<OIDCDiscoveryDocument> {
    try {
      const response = await fetch(discoveryUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch discovery document: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(
        `Failed to fetch OIDC discovery document: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build authorization URL
   */
  static async buildAuthorizationUrl(params: OIDCAuthParams): Promise<{
    url: string;
    state: string;
    codeVerifier?: string;
  }> {
    const { connectionId, tenantId, redirectUri, state, nonce, prompt, maxAge, loginHint, acrValues } = params;

    const connection = await db.sSOConnection.findFirst({
      where: { id: connectionId, tenantId, type: 'oidc', status: 'active' },
    });

    if (!connection) {
      throw new Error('OIDC connection not found or inactive');
    }

    if (!connection.oidcClientId) {
      throw new Error('OIDC client ID not configured');
    }

    let authorizationUrl = connection.oidcAuthorizationUrl;
    
    // Fetch discovery document if needed
    if (!authorizationUrl && connection.oidcDiscoveryUrl) {
      const discovery = await this.fetchDiscoveryDocument(connection.oidcDiscoveryUrl);
      authorizationUrl = discovery.authorization_endpoint;
    }

    if (!authorizationUrl) {
      throw new Error('OIDC authorization URL not configured');
    }

    const generatedState = state || this.generateState();
    const generatedNonce = nonce || this.generateNonce();
    
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    // Generate PKCE challenge if enabled
    if (connection.oidcUsePkce) {
      const pkce = this.generatePKCE();
      codeVerifier = pkce.code_verifier;
      codeChallenge = pkce.code_challenge;
    }

    // Build authorization URL
    const url = new URL(authorizationUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', connection.oidcClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', connection.oidcScopes || 'openid profile email');
    url.searchParams.set('state', generatedState);
    url.searchParams.set('nonce', generatedNonce);

    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }

    if (prompt) {
      url.searchParams.set('prompt', prompt);
    }

    if (maxAge !== undefined) {
      url.searchParams.set('max_age', maxAge.toString());
    }

    if (loginHint) {
      url.searchParams.set('login_hint', loginHint);
    }

    if (acrValues) {
      url.searchParams.set('acr_values', acrValues);
    }

    // Store state for verification
    this.warnProduction();
    this.stateStore.set(generatedState, {
      connectionId,
      codeVerifier,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Clean up expired states
    this.cleanupExpiredStates();

    return {
      url: url.toString(),
      state: generatedState,
      codeVerifier,
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCode(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<{ tokens: OIDCTokens; userInfo: OIDCUserInfo; connectionId: string }> {
    // Retrieve stored state
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new Error('Invalid or expired state');
    }

    if (stateData.expiresAt < new Date()) {
      this.stateStore.delete(state);
      throw new Error('State expired');
    }

    const connection = await db.sSOConnection.findFirst({
      where: { id: stateData.connectionId, type: 'oidc' },
    });

    if (!connection) {
      throw new Error('OIDC connection not found');
    }

    if (!connection.oidcClientId || !connection.oidcClientSecret) {
      throw new Error('OIDC client credentials not configured');
    }

    let tokenUrl = connection.oidcTokenUrl;

    // Fetch discovery document if needed
    if (!tokenUrl && connection.oidcDiscoveryUrl) {
      const discovery = await this.fetchDiscoveryDocument(connection.oidcDiscoveryUrl);
      tokenUrl = discovery.token_endpoint;
    }

    if (!tokenUrl) {
      throw new Error('OIDC token URL not configured');
    }

    // Build token request
    const tokenParams = new URLSearchParams();
    tokenParams.set('grant_type', 'authorization_code');
    tokenParams.set('code', code);
    tokenParams.set('redirect_uri', redirectUri);
    tokenParams.set('client_id', connection.oidcClientId);
    tokenParams.set('client_secret', connection.oidcClientSecret);

    if (stateData.codeVerifier) {
      tokenParams.set('code_verifier', stateData.codeVerifier);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens: OIDCTokens = await tokenResponse.json();

    // Get user info
    const userInfo = await this.getUserInfo(connection, tokens.access_token);

    // Clean up state
    this.stateStore.delete(state);

    // Update connection status
    await db.sSOConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
      },
    });

    return {
      tokens,
      userInfo,
      connectionId: connection.id,
    };
  }

  /**
   * Get user info from OIDC provider
   */
  static async getUserInfo(
    connection: {
      oidcUserInfoUrl?: string | null;
      oidcDiscoveryUrl?: string | null;
    },
    accessToken: string
  ): Promise<OIDCUserInfo> {
    let userInfoUrl = connection.oidcUserInfoUrl;

    // Fetch discovery document if needed
    if (!userInfoUrl && connection.oidcDiscoveryUrl) {
      const discovery = await this.fetchDiscoveryDocument(connection.oidcDiscoveryUrl);
      userInfoUrl = discovery.userinfo_endpoint;
    }

    if (!userInfoUrl) {
      throw new Error('OIDC UserInfo URL not configured');
    }

    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(
    connectionId: string,
    refreshToken: string
  ): Promise<OIDCTokens> {
    const connection = await db.sSOConnection.findFirst({
      where: { id: connectionId, type: 'oidc' },
    });

    if (!connection) {
      throw new Error('OIDC connection not found');
    }

    let tokenUrl = connection.oidcTokenUrl;

    if (!tokenUrl && connection.oidcDiscoveryUrl) {
      const discovery = await this.fetchDiscoveryDocument(connection.oidcDiscoveryUrl);
      tokenUrl = discovery.token_endpoint;
    }

    if (!tokenUrl || !connection.oidcClientId || !connection.oidcClientSecret) {
      throw new Error('OIDC configuration incomplete');
    }

    const tokenParams = new URLSearchParams();
    tokenParams.set('grant_type', 'refresh_token');
    tokenParams.set('refresh_token', refreshToken);
    tokenParams.set('client_id', connection.oidcClientId);
    tokenParams.set('client_secret', connection.oidcClientSecret);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return await response.json();
  }

  /**
   * Validate ID token
   */
  static async validateIdToken(
    idToken: string,
    connectionId: string
  ): Promise<{
    valid: boolean;
    payload?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const connection = await db.sSOConnection.findFirst({
        where: { id: connectionId, type: 'oidc' },
      });

      if (!connection) {
        return { valid: false, error: 'Connection not found' };
      }

      // Decode JWT without verification (for now)
      const [headerB64, payloadB64] = idToken.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());

      // Validate claims
      if (payload.iss !== connection.oidcDiscoveryUrl?.replace('/.well-known/openid-configuration', '')) {
        return { valid: false, error: 'Invalid issuer' };
      }

      if (payload.aud !== connection.oidcClientId) {
        return { valid: false, error: 'Invalid audience' };
      }

      if (payload.exp && payload.exp < Date.now() / 1000) {
        return { valid: false, error: 'Token expired' };
      }

      return { valid: true, payload };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }

  /**
   * Build logout URL
   */
  static async buildLogoutUrl(
    connectionId: string,
    postLogoutRedirectUri?: string,
    idTokenHint?: string
  ): Promise<string | null> {
    const connection = await db.sSOConnection.findFirst({
      where: { id: connectionId, type: 'oidc' },
    });

    if (!connection || !connection.oidcDiscoveryUrl) {
      return null;
    }

    try {
      const discovery = await this.fetchDiscoveryDocument(connection.oidcDiscoveryUrl);
      
      if (!discovery.end_session_endpoint) {
        return null;
      }

      const url = new URL(discovery.end_session_endpoint);
      
      if (postLogoutRedirectUri) {
        url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
      }
      
      if (idTokenHint) {
        url.searchParams.set('id_token_hint', idTokenHint);
      }

      return url.toString();
    } catch {
      return null;
    }
  }

  /**
   * Map OIDC user info to application user attributes
   */
  static mapUserInfo(
    userInfo: OIDCUserInfo,
    connection: {
      emailAttribute: string;
      firstNameAttribute: string;
      lastNameAttribute: string;
      nameAttribute?: string | null;
      roleAttribute?: string | null;
      departmentAttribute?: string | null;
      phoneAttribute?: string | null;
    }
  ): {
    email: string;
    firstName: string;
    lastName: string;
    name: string;
    role?: string;
    department?: string;
    phone?: string;
    avatar?: string;
  } {
    const getAttr = (name: string): string => {
      const value = userInfo[name];
      if (Array.isArray(value)) return value[0] || '';
      return typeof value === 'string' ? value : '';
    };

    return {
      email: getAttr(connection.emailAttribute) || userInfo.email || '',
      firstName: getAttr(connection.firstNameAttribute) || userInfo.given_name || '',
      lastName: getAttr(connection.lastNameAttribute) || userInfo.family_name || '',
      name: connection.nameAttribute
        ? getAttr(connection.nameAttribute)
        : userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim(),
      role: connection.roleAttribute ? getAttr(connection.roleAttribute) : undefined,
      department: connection.departmentAttribute
        ? getAttr(connection.departmentAttribute)
        : undefined,
      phone: connection.phoneAttribute
        ? getAttr(connection.phoneAttribute)
        : userInfo.phone_number,
      avatar: userInfo.picture,
    };
  }

  /**
   * Test OIDC connection
   */
  static async testConnection(connectionId: string, tenantId: string): Promise<{
    success: boolean;
    message: string;
    details?: {
      discoveryFetched: boolean;
      authorizationUrlValid: boolean;
      tokenUrlValid: boolean;
      userInfoUrlValid: boolean;
      error?: string;
    };
  }> {
    const connection = await db.sSOConnection.findFirst({
      where: { id: connectionId, tenantId, type: 'oidc' },
    });

    if (!connection) {
      return { success: false, message: 'OIDC connection not found' };
    }

    const details = {
      discoveryFetched: false,
      authorizationUrlValid: false,
      tokenUrlValid: false,
      userInfoUrlValid: false,
      error: undefined as string | undefined,
    };

    try {
      if (connection.oidcDiscoveryUrl) {
        const discovery = await this.fetchDiscoveryDocument(connection.oidcDiscoveryUrl);
        details.discoveryFetched = true;
        details.authorizationUrlValid = !!discovery.authorization_endpoint;
        details.tokenUrlValid = !!discovery.token_endpoint;
        details.userInfoUrlValid = !!discovery.userinfo_endpoint;
      } else {
        details.authorizationUrlValid = !!connection.oidcAuthorizationUrl;
        details.tokenUrlValid = !!connection.oidcTokenUrl;
        details.userInfoUrlValid = !!connection.oidcUserInfoUrl;
      }

      if (!details.authorizationUrlValid) {
        return {
          success: false,
          message: 'Authorization URL not configured or invalid',
          details,
        };
      }

      if (!details.tokenUrlValid) {
        return {
          success: false,
          message: 'Token URL not configured or invalid',
          details,
        };
      }

      // Update connection test status
      await db.sSOConnection.update({
        where: { id: connectionId },
        data: {
          testConnectionAt: new Date(),
          testConnectionStatus: 'success',
        },
      });

      return {
        success: true,
        message: 'OIDC connection test successful',
        details,
      };
    } catch (error) {
      details.error = error instanceof Error ? error.message : 'Unknown error';

      await db.sSOConnection.update({
        where: { id: connectionId },
        data: {
          testConnectionAt: new Date(),
          testConnectionStatus: 'failed',
        },
      });

      return {
        success: false,
        message: `OIDC connection test failed: ${details.error}`,
        details,
      };
    }
  }

  /**
   * Get callback URL for a connection
   */
  static getCallbackUrl(connectionId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/auth/sso/oidc/${connectionId}/callback`;
  }

  /**
   * Clean up expired states
   */
  private static cleanupExpiredStates(): void {
    const now = new Date();
    for (const [state, data] of this.stateStore.entries()) {
      if (data.expiresAt < now) {
        this.stateStore.delete(state);
      }
    }
  }
}

export default OIDCService;
