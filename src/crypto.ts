import crypto from 'crypto';

export type Crypto = {
  encrypt(value: string, salt: string): string;
  decrypt(value: string, salt: string): string;
  hash(value: string): Promise<string>;
};

const algo = 'aes-128-gcm';

export const makeCrypto = (config: { auth: { cryptoSecret: string } }) => {
  const encrypt = (text: string, salt: string) => {
    const secret = config.auth.cryptoSecret.slice(0, 8) + salt.slice(-8);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algo, secret, iv);
    const hash = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    const tag = cipher.getAuthTag();
    const tags = tag.toString('hex');
    const ivs = iv.toString('hex');
    const encrypted = [ivs, hash, tags].join(':');
    return encrypted;
  };

  const decrypt = (encrypted: string, salt: string) => {
    const secret = config.auth.cryptoSecret.slice(0, 8) + salt.slice(-8);
    const [ivs, hash, tags] = encrypted.split(':');
    const iv = Buffer.from(ivs, 'hex');
    const tag = Buffer.from(tags, 'hex');

    const decipher = crypto.createDecipheriv(algo, secret, iv);
    decipher.setAuthTag(tag);
    const decrypted =
      decipher.update(hash, 'hex', 'utf-8') + decipher.final('utf-8');

    return decrypted.toString();
  };

  const hash = (text: string) => {
    return new Promise<string>((res, rej) => {
      crypto.pbkdf2(
        text,
        process.env.CRYPTO_SECRET,
        1000,
        64,
        'sha512',
        (err, derived) => {
          if (err) {
            rej(err);
            return;
          }
          res(derived.toString('hex'));
        },
      );
    });
  };

  return { encrypt, decrypt, hash };
};
