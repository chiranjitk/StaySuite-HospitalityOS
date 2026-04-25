/**
 * Encryption Utility
 * 
 * Provides AES-256-GCM encryption for sensitive data like OAuth secrets.
 * Uses environment variable ENCRYPTION_KEY or generates a default key.
 * 
 * Output format: iv:authTag:encryptedData (hex encoded)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for IV
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag

/**
 * Get the encryption key from environment or use default
 * In production, always set ENCRYPTION_KEY environment variable
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    // If the key is provided as hex string
    if (envKey.length === 64 && /^[a-fA-F0-9]{64}$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    // If the key is provided as a string, derive a key from it
    return crypto.createHash('sha256').update(envKey).digest();
  }
  
  // In production, ENCRYPTION_KEY must be set — never use a default
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[ENCRYPTION] ENCRYPTION_KEY environment variable is required in production. Generate with: openssl rand -hex 32');
  }
  console.warn('[ENCRYPTION] Warning: Using default encryption key. Set ENCRYPTION_KEY in production.');
  return crypto.createHash('sha256').update('staysuite-default-encryption-key-change-in-production').digest();
}

/**
 * Encrypt a text string using AES-256-GCM
 * 
 * @param text - The plaintext to encrypt
 * @returns The encrypted text in format: iv:authTag:encryptedData (hex encoded)
 */
export function encrypt(text: string): string {
  if (!text) {
    return '';
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return format: iv:authTag:encryptedData (all hex encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted text string
 * 
 * @param encryptedText - The encrypted text in format: iv:authTag:encryptedData (hex encoded)
 * @returns The decrypted plaintext, or null if decryption fails
 */
export function decrypt(encryptedText: string): string | null {
  if (!encryptedText) {
    return null;
  }

  try {
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      console.error('[ENCRYPTION] Invalid encrypted text format');
      return null;
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[ENCRYPTION] Decryption failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Check if a string is encrypted (has the expected format)
 * 
 * @param text - The text to check
 * @returns True if the text appears to be encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text) {
    return false;
  }
  
  const parts = text.split(':');
  if (parts.length !== 3) {
    return false;
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  
  // IV should be 32 hex chars (16 bytes)
  if (ivHex.length !== 32 || !/^[a-fA-F0-9]{32}$/.test(ivHex)) {
    return false;
  }
  
  // Auth tag should be 32 hex chars (16 bytes)
  if (authTagHex.length !== 32 || !/^[a-fA-F0-9]{32}$/.test(authTagHex)) {
    return false;
  }
  
  // Encrypted data should be hex
  if (!/^[a-fA-F0-9]+$/.test(encrypted)) {
    return false;
  }
  
  return true;
}

/**
 * Encrypt an object by converting to JSON first
 * 
 * @param obj - The object to encrypt
 * @returns The encrypted text
 */
export function encryptObject(obj: Record<string, unknown>): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt an encrypted text and parse as JSON
 * 
 * @param encryptedText - The encrypted text
 * @returns The decrypted object, or null if decryption fails
 */
export function decryptObject<T = Record<string, unknown>>(encryptedText: string): T | null {
  const decrypted = decrypt(encryptedText);
  
  if (!decrypted) {
    return null;
  }
  
  try {
    return JSON.parse(decrypted) as T;
  } catch {
    console.error('[ENCRYPTION] Failed to parse decrypted JSON');
    return null;
  }
}

const encryptionUtils = {
  encrypt,
  decrypt,
  isEncrypted,
  encryptObject,
  decryptObject,
};

export default encryptionUtils;
