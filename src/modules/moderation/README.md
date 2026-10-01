# moderation

Report and block UI plus the objectionable-content list. Backed by `reports` and `blocked_users`
(migration `20260930000000_moderation.sql`). Everything is imported from `@/modules/moderation`.

## ReportSheet

```tsx
<ReportSheet
  target={{ type: "comment", id: commentId, ownerId: authorId }}
  onClose={() => setOpen(false)}
  onReported={() => {}}   // optional; fires on success while the sheet is mounted
/>
```

- `type` is `profile | comment | dm_message | collection_item`. For `profile`, `id` must equal `ownerId`
  (the DB checks it). `ownerId` is the user who wrote the content.
- Mount it to open it, unmount to close. `onClose` fires on Cancel, scrim, Android back and Done.
  `onReported` fires on success only, and only while the sheet is still mounted; the sheet stays open on its
  "sent" state until Done. A caller that navigates away mid-request must refetch instead of waiting for it.
- Renders nothing and calls `onClose` when `ownerId` is the signed-in user.
- An already-reported target (23505) shows the same "sent" state, so a user learns nothing about earlier reports.

## BlockUserSheet

```tsx
<BlockUserSheet userId={id} displayName={name} onClose={close} onBlocked={() => {}} />
```

`displayName` is optional ("this user" is used without it). `onBlocked` fires on success while the sheet is
still mounted; a caller that navigates away mid-request must refetch. Cancel, scrim and back are inert while the
write is running. Already blocked (23505) lands on the "blocked" state. `useBlockUser(userId, onBlocked?)`
is the hook behind it.

## Other exports

- `BlockedUsersScreen`: the Blocked users screen; the route `(tabs)/profile/blocked-users.tsx` only renders it.
- `useBlockedUsers()`: `{ state, users, busyIds, failedId, refetch, unblock, clearFailure }`, tagged by
  signed-in user so a list never leaks across accounts or sign-out.
- `OBJECTIONABLE_CATEGORIES`: the seven reasons, each `{ key, label, description }`. Reason rows render
  `label`; Build 11's terms text renders `label` + `description`. Edit reasons only here.
- Types: `ReportTarget`, `ReportTargetType`, `ReportReason`, `BlockedUser`.

## Rules

- **Never chain `.select()` on a `reports` insert and never `.upsert()` it.** The client has INSERT only on
  `reports` (no SELECT), so either fails with 42501. Same bare insert for `blocked_users`.
- Unexpected errors go to Sentry as a fresh error carrying only the action and SQLSTATE, never the message
  (a constraint error can echo the row, including the report details). No SQLSTATE means offline: not reported.
- `ModerationDevHarness` is dev-only. It is loaded from `src/app/debug.tsx` behind `__DEV__` and is
  deliberately **not** exported from `index.ts`; keep it that way or it ships.

## Duty for later Builds

Each Build that adds a UGC surface opens `ReportSheet` with the right `target` (24 profile + `BlockUserSheet`,
25 comment + collection item/caption, 27 DM message), adds its "remove this content" query to
`docs/ADMIN-MODERATION.md`, and updates this README's caller list. Build 11 adds the terms gate here.
