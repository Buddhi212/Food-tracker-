# NutriLog Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership Isolation**: A document at `/users/{userId}/logs/{date}` belongs exclusively to the authenticated, email-verified user whose `request.auth.uid == userId`. No user can read, list, create, update, or delete another user's logs.
2. **Path-to-Payload Integrity**: `request.resource.data.userId` must equal both `{userId}` and `request.auth.uid`. `request.resource.data.date` must equal `{date}` and match `^\d{4}-\d{2}-\d{2}$`.
3. **Immutability**: Once created, `userId` and `date` cannot be modified on update.
4. **Temporal Integrity**: `updatedAt` must always equal `request.time` (server timestamp). Client-forged timestamps are rejected.
5. **Bounded Payload & Schema Strictness**: Only keys `['userId', 'date', 'items', 'updatedAt']` are allowed. `items` must be a list of at most 100 entries, and when non-empty, the entry structure (`id`, `meal`, `foodItem`, `quantity`, `measurement`, `calories`, `protein`, `carbs`, `fat`, `sugar`, `createdAt`) and bounded numeric/string fields are validated.
6. **Verified Identity**: Write operations require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `request.auth == null` attempting `get` or `set` on `/users/uid1/logs/2026-11-21` -> `PERMISSION_DENIED`.
2. **Cross-Tenant Read**: `uid2` attempting `get` on `/users/uid1/logs/2026-11-21` -> `PERMISSION_DENIED`.
3. **Cross-Tenant List**: `uid2` attempting `list` on `/users/uid1/logs` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Create**: `uid1` creating `/users/uid1/logs/2026-11-21` with `userId: "uid2"` -> `PERMISSION_DENIED`.
5. **Unverified Email Write**: `uid1` with `email_verified: false` attempting `create`/`update` -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection**: `uid1` sending `{ userId: "uid1", date: "2026-11-21", items: [], updatedAt: request.time, isAdmin: true }` -> `PERMISSION_DENIED`.
7. **Forged Client Timestamp**: `uid1` sending `updatedAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
8. **Path Poisoning (Oversized ID)**: `uid1` writing to `/users/uid1/logs/<2000-char-string>` -> `PERMISSION_DENIED`.
9. **Date Mismatch**: `uid1` writing to `/users/uid1/logs/2026-11-21` with `data.date: "2026-11-22"` -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation**: `uid1` updating `userId` or `date` on an existing document -> `PERMISSION_DENIED`.
11. **Array Overflow (Denial of Wallet)**: `uid1` writing `items` array with 101 elements (`> 100`) -> `PERMISSION_DENIED`.
12. **Type Poisoning in `items`**: `uid1` writing `items: ["not-a-map"]` or negative calories -> `PERMISSION_DENIED`.
