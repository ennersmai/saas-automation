import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

interface EncryptedPayload {
  iv: string;
  value: string;
  tag: string;
}

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('ENCRYPTION_KEY');

    if (!secret) {
      throw new Error('ENCRYPTION_KEY is not configured');
    }

    const key = Buffer.from(secret, 'base64');

    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a base64 encoded 32-byte value');
    }

    this.key = key;
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      iv: iv.toString('base64'),
      value: encrypted.toString('base64'),
      tag: authTag.toString('base64'),
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  }

  decrypt(cipherText: string): string {
    const decoded = Buffer.from(cipherText, 'base64').toString('utf8');
    const payload = JSON.parse(decoded) as EncryptedPayload;

    const iv = Buffer.from(payload.iv, 'base64');
    const encrypted = Buffer.from(payload.value, 'base64');
    const authTag = Buffer.from(payload.tag, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
