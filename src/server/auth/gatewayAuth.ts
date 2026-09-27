import { Request, Response, NextFunction } from 'express';
import { loadGatewayConfig } from '../config/gatewayConfig';
import { log } from '../logging/logger';

export interface AuthValidationResult {
  valid: boolean;
  reason?: string;
  authMethod?: 'X-Gateway-Auth' | 'Bearer' | 'QueryToken';
}

/**
 * Validates credentials against current Gateway configuration
 */
export function validateGatewayCredentials(headers: Record<string, string | string[] | undefined>, queryToken?: string): AuthValidationResult {
  const config = loadGatewayConfig();

  const reqId = (headers['x-gateway-id'] || headers['X-Gateway-Id'] || '') as string;
  const reqAuth = (headers['x-gateway-auth'] || headers['X-Gateway-Auth'] || '') as string;
  const authHeader = (headers['authorization'] || headers['Authorization'] || '') as string;

  // Extract Bearer token if present
  let bearerToken = '';
  if (authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.slice(7).trim();
  }

  // 1. Mechanism: X-Gateway-Auth
  if (reqAuth) {
    if (reqId && reqId.trim() !== config.gatewayId.trim()) {
      return { valid: false, reason: 'Invalid Gateway ID' };
    }
    if (reqAuth.trim() === config.gatewayPassword.trim()) {
      return { valid: true, authMethod: 'X-Gateway-Auth' };
    }
    return { valid: false, reason: 'Invalid Gateway Password (X-Gateway-Auth mismatch)' };
  }

  // 2. Mechanism: Authorization: Bearer <token>
  if (bearerToken) {
    if (bearerToken === config.gatewayPassword.trim()) {
      return { valid: true, authMethod: 'Bearer' };
    }
    return { valid: false, reason: 'Invalid Bearer token' };
  }

  // 3. Mechanism: Query parameter token (e.g. for direct <video> or <img src> URLs in browser)
  if (queryToken && queryToken.trim() === config.gatewayPassword.trim()) {
    return { valid: true, authMethod: 'QueryToken' };
  }

  return { valid: false, reason: 'Missing authentication headers (X-Gateway-Auth or Bearer token required)' };
}

/**
 * Express middleware to protect Gateway routes
 */
export function requireGatewayAuth(req: Request, res: Response, next: NextFunction): void {
  const tokenQuery = typeof req.query.token === 'string' ? req.query.token : undefined;
  const result = validateGatewayCredentials(req.headers, tokenQuery);

  if (result.valid) {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    log('AUTH', `Authorized client from ${clientIp} using ${result.authMethod}`);
    return next();
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  log('AUTH', `Denied unauthorized access from ${clientIp}: ${result.reason}`, 'warn');

  res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: result.reason || 'Authentication required',
    supportedMechanisms: ['X-Gateway-Auth', 'Authorization: Bearer <token>', 'query ?token=<password>'],
  });
}
