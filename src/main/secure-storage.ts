import keytar from "keytar";

import { logger } from "./logger/index";

const SERVICE = "gaming-copilot";

export async function storeKey(account: string, value: string): Promise<void> {
  await keytar.setPassword(SERVICE, account, value);
  logger.info("SecureStorage", `Stored secure key for: ${account}`);
}

export async function retrieveKey(account: string): Promise<string | null> {
  return await keytar.getPassword(SERVICE, account);
}

export async function deleteKey(account: string): Promise<void> {
  await keytar.deletePassword(SERVICE, account);
  logger.info("SecureStorage", `Deleted secure key for: ${account}`);
}

export function getAccount(serviceName: string, endpointName?: string): string {
  return endpointName ? `${serviceName}-${endpointName}-api-key` : `${serviceName}-api-key`;
}
