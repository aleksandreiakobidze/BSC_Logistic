/**
 * Recursively convert Prisma `Decimal` values (and other non-plain objects) into
 * JSON-serializable primitives so they can be passed from Server Components to
 * Client Components without "Only plain objects..." warnings.
 */
import { Prisma } from "@prisma/client";

type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? Date
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export function serialize<T>(value: T): Serialized<T> {
  if (value === null || value === undefined) return value as Serialized<T>;
  if (value instanceof Prisma.Decimal) return Number(value) as Serialized<T>;
  if (value instanceof Date) return value as Serialized<T>;
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as Serialized<T>;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out as Serialized<T>;
  }
  return value as Serialized<T>;
}
