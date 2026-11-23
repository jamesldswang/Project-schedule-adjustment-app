# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. Every `/projects/{projectId}` document belongs to a single verified user (`ownerId == request.auth.uid`).
2. Subcollections (`tasks`, `checkpoints`, `revisions`, `snapshotTasks`) inherit ownership from their parent `/projects/{projectId}` document via `get()` (Master Gate) and enforce `ownerId == request.auth.uid` and `projectId == projectId`.
3. `createdAt` and `ownerId` and `projectId` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
4. All document IDs (`projectId`, `taskId`, `checkpointId`, `revisionId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
5. `revisions` and `snapshotTasks` are append-only immutable audit snapshots (no client updates allowed).
6. All arrays (`phases`, `snapshotPhases`, `tags`) are strictly bounded (`<= 10` items) with element type verification on index `0`.

## 2. Dirty Dozen Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. Unauthenticated read or write on `/projects/{projectId}` (`request.auth == null`).
2. Unverified email (`request.auth.token.email_verified == false`) attempting to create a project.
3. Identity spoofing: setting `ownerId` to another user's UID on `create`.
4. Shadow field injection: adding extra field `isAdmin: true` on `create` or `update`.
5. Non-owner reading or listing another user's project (`resource.data.ownerId != request.auth.uid`).
6. Path ID poisoning: creating `/projects/` with a 500-char ID or invalid characters (`../etc`).
7. Modifying immutable `ownerId` or `createdAt` during `update`.
8. Client timestamp forgery: passing a backdated `createdAt` or `updatedAt != request.time`.
9. Cross-project orphan write: creating a task under `/projects/p1/tasks/t1` with `projectId: "p2"`.
10. Unbounded array injection: sending `phases` or `tags` with `> 10` elements or non-string tag elements.
11. Mutating an immutable `PlanRevision` or `snapshotTask` via `update`.
12. Blanket `list` query without `resource.data.ownerId == request.auth.uid` constraint.
