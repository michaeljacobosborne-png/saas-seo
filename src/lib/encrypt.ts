import crypto from 'crypto'

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY
  if (!k) throw new Error('ENCRYPTION_KEY environment variable is not set')
  return Buffer.from(k, 'hex')
}

export function encrypt(text: string): string {
  const KEY = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text: string): string {
  const KEY = getKey()
  const [ivHex, encryptedHex] = text.split(':')
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, Buffer.from(ivHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString()
}
