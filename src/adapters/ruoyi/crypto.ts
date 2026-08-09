import CryptoJS from 'crypto-js';
import JSEncrypt from 'jsencrypt';
import { getClientEnv, isClientEncryptEnabled } from './env';

const randomChars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const randomCharCount = randomChars.length;
const randomByteLimit = 256 - (256 % randomCharCount);

let publicEncryptor: JSEncrypt | undefined;
let privateEncryptor: JSEncrypt | undefined;

const getSecureRandomByte = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0];
  }
  return Math.floor(Math.random() * 256);
};

const generateRandomString = () => {
  let result = '';
  for (let i = 0; i < 32; i += 1) {
    let randomByte = getSecureRandomByte();
    while (randomByte >= randomByteLimit) {
      randomByte = getSecureRandomByte();
    }
    result += randomChars.charAt(randomByte % randomCharCount);
  }
  return result;
};

export const isEncryptEnabled = isClientEncryptEnabled;

export const generateAesKey = () =>
  CryptoJS.enc.Utf8.parse(generateRandomString());

export const encryptBase64 = (str: CryptoJS.lib.WordArray) =>
  CryptoJS.enc.Base64.stringify(str);

export const decryptBase64 = (str: string) => CryptoJS.enc.Base64.parse(str);

export const encryptWithAes = (
  message: string,
  aesKey: CryptoJS.lib.WordArray,
) => {
  const encrypted = CryptoJS.AES.encrypt(message, aesKey, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
};

export const decryptWithAes = (
  message: string,
  aesKey: CryptoJS.lib.WordArray,
) => {
  const decrypted = CryptoJS.AES.decrypt(message, aesKey, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
};

const createRsa = (key: string, type: 'public' | 'private') => {
  if (!key) {
    throw new Error(`Missing UMI_APP_RSA_${type.toUpperCase()}_KEY`);
  }
  const encryptor = new JSEncrypt();
  if (type === 'public') {
    encryptor.setPublicKey(key);
  } else {
    encryptor.setPrivateKey(key);
  }
  return encryptor;
};

const getPublicEncryptor = () => {
  if (!publicEncryptor) {
    publicEncryptor = createRsa(
      getClientEnv('UMI_APP_RSA_PUBLIC_KEY'),
      'public',
    );
  }
  return publicEncryptor;
};

const getPrivateEncryptor = () => {
  if (!privateEncryptor) {
    privateEncryptor = createRsa(
      getClientEnv('UMI_APP_RSA_PRIVATE_KEY'),
      'private',
    );
  }
  return privateEncryptor;
};

export const rsaEncrypt = (message: string) => {
  const encrypted = getPublicEncryptor().encrypt(message);
  if (!encrypted) {
    throw new Error('RSA encrypt failed');
  }
  return encrypted;
};

export const rsaDecrypt = (message: string) => {
  const decrypted = getPrivateEncryptor().decrypt(message);
  if (!decrypted) {
    throw new Error('RSA decrypt failed');
  }
  return decrypted;
};
