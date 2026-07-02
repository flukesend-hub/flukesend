/*
  Shared cron auth. Constant time comparison of the bearer token so the
  secret cannot be probed byte by byte from response timing. Callers still
  answer 503 themselves when the secret is unset.
*/
import "server-only";
import { timingSafeEqual } from "crypto";

export function cronAuthorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
