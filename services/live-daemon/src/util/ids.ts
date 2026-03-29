import { v4 as uuidv4 } from "uuid";

export function createGatewayMessageId(counter: number): string {
  return `out_live_${String(counter).padStart(4, "0")}`;
}

export function createSseClientId(): string {
  return uuidv4();
}
