import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db } from './db';
import { DownloadToken } from '../src/lib/types';
import { generateSignedToken, verifySignedToken, sanitizeFilename } from '../src/lib/security';

export interface CreateTokenParams {
  filePath: string;
  fileName?: string;
  durationMinutes?: number;
  singleUse?: boolean;
  maxUses?: number;
  ipRestriction?: string;
}

export class TokenManager {
  public createToken(params: CreateTokenParams): DownloadToken {
    const duration = params.durationMinutes || 60; // 1 hour default
    const expiresAt = Date.now() + duration * 60 * 1000;
    const fileId = `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const fileName = params.fileName || path.basename(params.filePath);
    let fileSize = 0;
    try {
      if (fs.existsSync(params.filePath)) {
        fileSize = fs.statSync(params.filePath).size;
      }
    } catch {
      fileSize = 1048576; // fallback 1MB
    }

    const tokenString = generateSignedToken({
      fileId,
      expiresAt,
      salt: crypto.randomBytes(8).toString('hex'),
    });

    const tokenRecord: DownloadToken = {
      token: tokenString,
      fileId,
      fileName: sanitizeFilename(fileName),
      filePath: params.filePath,
      fileSize,
      createdAt: Date.now(),
      expiresAt,
      ipRestriction: params.ipRestriction,
      singleUse: params.singleUse ?? false,
      usedCount: 0,
      maxUses: params.maxUses || (params.singleUse ? 1 : 20),
      revoked: false,
    };

    db.addToken(tokenRecord);
    return tokenRecord;
  }

  public validateAndConsumeToken(tokenString: string, clientIp?: string): { valid: boolean; token?: DownloadToken; error?: string } {
    const verified = verifySignedToken(tokenString);
    if (!verified.valid) {
      return { valid: false, error: verified.error || 'Invalid token signature' };
    }

    const token = db.getToken(tokenString);
    if (!token) {
      return { valid: false, error: 'Token not found or already purged' };
    }

    if (token.revoked) {
      return { valid: false, error: 'Token has been revoked by administrator' };
    }

    if (Date.now() > token.expiresAt) {
      return { valid: false, error: 'Download token has expired' };
    }

    if (token.maxUses > 0 && token.usedCount >= token.maxUses) {
      return { valid: false, error: 'Maximum download usage limit reached' };
    }

    if (token.ipRestriction && clientIp && token.ipRestriction !== clientIp) {
      return { valid: false, error: 'Token is restricted to a different IP address' };
    }

    // Increment usage
    db.updateToken(tokenString, {
      usedCount: token.usedCount + 1,
    });

    return { valid: true, token };
  }
}

export const tokenManager = new TokenManager();
