import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const raw = process.env.AI_CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("AI credential encryption is not configured on the server.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
  return key;
}

export function encryptCredential(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptCredential(value: string) {
  const [version, ivValue, tagValue, dataValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !dataValue) throw new Error("Stored AI credential has an unsupported format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataValue, "base64")), decipher.final()]).toString("utf8");
}
