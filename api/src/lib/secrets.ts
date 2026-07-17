import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export class SecretBox {
  private readonly key: Buffer

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64')
    if (this.key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY deve conter 32 bytes em base64')
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
  }

  decrypt(value: string): string {
    const [version, encodedIv, encodedTag, encodedEncrypted] = value.split('.')
    if (version !== 'v1' || !encodedIv || !encodedTag || !encodedEncrypted) throw new Error('Segredo criptografado inválido')
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(encodedIv, 'base64url'))
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(encodedEncrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  }
}
