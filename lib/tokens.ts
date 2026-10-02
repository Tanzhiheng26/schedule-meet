import { randomBytes } from "node:crypto";

export const newToken = () => randomBytes(18).toString("base64url");
