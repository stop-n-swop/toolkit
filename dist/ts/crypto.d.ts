export type Crypto = {
    encrypt(value: string, salt: string): string;
    decrypt(value: string, salt: string): string;
    hash(value: string): Promise<string>;
};
export declare const makeCrypto: (config: {
    auth: {
        cryptoSecret: string;
    };
}) => {
    encrypt: (text: string, salt: string) => string;
    decrypt: (encrypted: string, salt: string) => string;
    hash: (text: string) => Promise<string>;
};
