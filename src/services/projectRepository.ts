import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import {
  CheckpointItem,
  CheckpointTask,
  PhaseInfo,
  PlanRevision,
  ProjectPlan,
  ScheduleTask,
} from '../types/schedule';

function sanitizeTaskPayload(
  task: ScheduleTask,
  projectId: string,
  ownerId: string,
  sortOrder: number,
  includeCreatedAt: boolean,
) {
  const payload: Record<string, unknown> = {
    projectId,
    ownerId,
    phaseId: task.phaseId.slice(0, 40),
    name: task.name.slice(0, 200),
    type: task.type,
    startDate: task.startDate.slice(0, 20),
    durationDays: task.type === 'milestone' ? 0 : Math.max(0, Math.min(3650, task.durationDays)),
    endDate: task.endDate.slice(0, 20),
    owner: (task.owner || '未指派').slice(0, 80),
    status: task.status,
    progress: Math.max(0, Math.min(100, task.progress || 0)),
    dependsOn: task.dependsOn ? task.dependsOn.slice(0, 128) : null,
    tags: (task.tags || []).slice(0, 10).map((t) => String(t).slice(0, 120)),
    notes: (task.notes || '').slice(0, 1000),
    dateSubLabel: (task.dateSubLabel || '').slice(0, 40),
    sortOrder,
    updatedAt: serverTimestamp(),
  };

  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }

  return payload;
}

function sanitizePhases(phases: PhaseInfo[]): PhaseInfo[] {
  return phases.slice(0, 10).map((p) => ({
    id: p.id.slice(0, 40),
    code: p.code.slice(0, 20),
    name: p.name.slice(0, 100),
    color: p.color,
  }));
}

function mapDocToTask(id: string, data: Record<string, unknown>): ScheduleTask {
  return {
    id,
    phaseId: String(data.phaseId || 'p1'),
    name: String(data.name || ''),
    type: data.type === 'milestone' ? 'milestone' : 'task',
    startDate: String(data.startDate || ''),
    durationDays: Number(data.durationDays || 0),
    endDate: String(data.endDate || ''),
    owner: String(data.owner || ''),
    status: (data.status as ScheduleTask['status']) || 'not_started',
    progress: Number(data.progress || 0),
    dependsOn: data.dependsOn ? String(data.dependsOn) : null,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    dateSubLabel: data.dateSubLabel ? String(data.dateSubLabel) : undefined,
  };
}

export async function fetchUserProjects(uid: string): Promise<ProjectPlan[]> {
  const projectsPath = 'projects';
  try {
    const q = query(collection(db, projectsPath), where('ownerId', '==', uid));
    const projSnap = await getDocs(q);

    const results: ProjectPlan[] = [];
    for (const pDoc of projSnap.docs) {
      const pData = pDoc.data();
      const projectId = pDoc.id;

      // Fetch tasks
      const tasksPath = `projects/${projectId}/tasks`;
      let tasks: ScheduleTask[] = [];
      try {
        const tasksSnap = await getDocs(
          query(collection(db, tasksPath), where('ownerId', '==', uid)),
        );
        const sortedDocs = [...tasksSnap.docs].sort(
          (a, b) => Number(a.data().sortOrder ?? 0) - Number(b.data().sortOrder ?? 0),
        );
        tasks = sortedDocs.map((d) => mapDocToTask(d.id, d.data()));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, tasksPath);
      }

      // Fetch checkpoints
      const cpPath = `projects/${projectId}/checkpoints`;
      let checkpoints: CheckpointItem[] = [];
      try {
        const cpSnap = await getDocs(
          query(collection(db, cpPath), where('ownerId', '==', uid)),
        );
        checkpoints = cpSnap.docs.map((d) => {
          const c = d.data();
          return {
            id: d.id,
            date: String(c.date || ''),
            title: String(c.title || ''),
            owner: String(c.owner || ''),
            note: String(c.note || ''),
            version: String(c.version || '1.0'),
            tasks: mapCheckpointTasks(c.tasks),
          };
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, cpPath);
      }

      // Fetch revisions + their snapshotTasks
      const revPath = `projects/${projectId}/revisions`;
      const revisions: PlanRevision[] = [];
      try {
        const revSnap = await getDocs(
          query(collection(db, revPath), where('ownerId', '==', uid)),
        );
        const sortedRevDocs = [...revSnap.docs].sort((a, b) =>
          String(a.data().createdAtLabel || '').localeCompare(
            String(b.data().createdAtLabel || ''),
          ),
        );

        for (const rDoc of sortedRevDocs) {
          const r = rDoc.data();
          const snapTasksPath = `projects/${projectId}/revisions/${rDoc.id}/snapshotTasks`;
          let snapshotTasks: ScheduleTask[] = [];
          try {
            const snapTasksSnap = await getDocs(
              query(collection(db, snapTasksPath), where('ownerId', '==', uid)),
            );
            const sortedSnapDocs = [...snapTasksSnap.docs].sort(
              (a, b) => Number(a.data().sortOrder ?? 0) - Number(b.data().sortOrder ?? 0),
            );
            snapshotTasks = sortedSnapDocs.map((sd) => mapDocToTask(sd.id, sd.data()));
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, snapTasksPath);
          }

          revisions.push({
            id: rDoc.id,
            version: String(r.version || 'v1.0.0'),
            title: String(r.title || ''),
            createdAt: String(r.createdAtLabel || ''),
            author: String(r.author || ''),
            category: (r.category as PlanRevision['category']) || '初始基準',
            reason: String(r.reason || ''),
            impactSummary: String(r.impactSummary || ''),
            snapshotPhases: Array.isArray(r.snapshotPhases)
              ? (r.snapshotPhases as PhaseInfo[])
              : [],
            snapshotTasks,
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, revPath);
      }

      results.push({
        id: projectId,
        code: String(pData.code || ''),
        name: String(pData.name || ''),
        owner: String(pData.owner || ''),
        referenceDate: String(pData.referenceDate || ''),
        pendingNote: String(pData.pendingNote || ''),
        issueStats: pData.issueStats as ProjectPlan['issueStats'],
        phases: Array.isArray(pData.phases) ? (pData.phases as PhaseInfo[]) : [],
        tasks,
        checkpoints,
        revisions,
      });
    }

    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, projectsPath);
  }
}

export async function createProjectInDb(uid: string, project: ProjectPlan): Promise<void> {
  const projectPath = `projects/${project.id}`;
  try {
    // Step 1: Create parent project document first so subcollection security rules see it
    await setDoc(doc(db, 'projects', project.id), {
      ownerId: uid,
      code: project.code.slice(0, 32),
      name: project.name.slice(0, 160),
      owner: project.owner.slice(0, 80),
      referenceDate: project.referenceDate.slice(0, 20),
      pendingNote: project.pendingNote.slice(0, 2000),
      issueStats: {
        total: Number(project.issueStats.total || 0),
        resolved: Number(project.issueStats.resolved || 0),
        unresolved: Number(project.issueStats.unresolved || 0),
        pendingLabel: String(project.issueStats.pendingLabel || '').slice(0, 60),
      },
      phases: sanitizePhases(project.phases),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, projectPath);
  }

  // Step 2: Batch write tasks, checkpoints, revisions, and snapshotTasks
  try {
    const batch = writeBatch(db);
    project.tasks.forEach((task, idx) => {
      const taskRef = doc(db, `projects/${project.id}/tasks`, task.id);
      batch.set(taskRef, sanitizeTaskPayload(task, project.id, uid, idx, true));
    });

    project.checkpoints.forEach((cp) => {
      const cpRef = doc(db, `projects/${project.id}/checkpoints`, cp.id);
      batch.set(cpRef, {
        projectId: project.id,
        ownerId: uid,
        ...checkpointFields(cp),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    project.revisions.forEach((rev) => {
      const revRef = doc(db, `projects/${project.id}/revisions`, rev.id);
      batch.set(revRef, {
        projectId: project.id,
        ownerId: uid,
        version: rev.version.slice(0, 32),
        title: rev.title.slice(0, 200),
        createdAtLabel: rev.createdAt.slice(0, 40),
        author: rev.author.slice(0, 80),
        category: rev.category,
        reason: rev.reason.slice(0, 2000),
        impactSummary: rev.impactSummary.slice(0, 1000),
        snapshotPhases: sanitizePhases(rev.snapshotPhases),
        createdAt: serverTimestamp(),
      });

      rev.snapshotTasks.forEach((st, idx) => {
        const stRef = doc(
          db,
          `projects/${project.id}/revisions/${rev.id}/snapshotTasks`,
          st.id,
        );
        batch.set(stRef, sanitizeTaskPayload(st, project.id, uid, idx, true));
      });
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `projects/${project.id}/subcollections`);
  }
}

export async function syncProjectTasksInDb(
  uid: string,
  projectId: string,
  prevTasks: ScheduleTask[],
  nextTasks: ScheduleTask[],
): Promise<void> {
  const path = `projects/${projectId}/tasks`;
  try {
    const batch = writeBatch(db);
    const prevMap = new Map(prevTasks.map((t) => [t.id, t]));
    const nextIds = new Set(nextTasks.map((t) => t.id));

    nextTasks.forEach((task, idx) => {
      const taskRef = doc(db, path, task.id);
      const prev = prevMap.get(task.id);
      if (!prev) {
        batch.set(taskRef, sanitizeTaskPayload(task, projectId, uid, idx, true));
      } else {
        batch.update(taskRef, sanitizeTaskPayload(task, projectId, uid, idx, false));
      }
    });

    prevTasks.forEach((prev) => {
      if (!nextIds.has(prev.id)) {
        batch.delete(doc(db, path, prev.id));
      }
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateProjectPendingNoteInDb(
  projectId: string,
  pendingNote: string,
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      pendingNote: pendingNote.slice(0, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

function checkpointFields(cp: CheckpointItem) {
  return {
    date: (cp.date || '-').slice(0, 32),
    title: cp.title.slice(0, 200),
    owner: (cp.owner || '-').slice(0, 80),
    note: (cp.note || '').slice(0, 1000),
    version: (cp.version || '1.0').slice(0, 32),
    tasks: (cp.tasks || []).slice(0, 50).map((t) => ({
      id: String(t.id).slice(0, 64),
      title: (t.title || '').slice(0, 200),
      owner: (t.owner || '').slice(0, 80),
      startDate: (t.startDate || '').slice(0, 10),
      chainPrev: !!t.chainPrev,
      durationDays: Math.max(0, Math.min(3650, Math.floor(Number(t.durationDays) || 0))),
      oooDays: Math.max(0, Math.min(3650, Math.floor(Number(t.oooDays) || 0))),
      note: (t.note || '').slice(0, 500),
    })),
  };
}

function mapCheckpointTasks(raw: unknown): CheckpointTask[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t: Record<string, unknown>, i) => ({
    id: String(t.id || `cpt-${i}`),
    title: String(t.title || ''),
    owner: String(t.owner || ''),
    startDate: String(t.startDate || ''),
    chainPrev: Boolean(t.chainPrev),
    durationDays: Number(t.durationDays) || 0,
    oooDays: Number(t.oooDays) || 0,
    note: String(t.note || ''),
  }));
}

export async function syncCheckpointsInDb(
  uid: string,
  projectId: string,
  prevCheckpoints: CheckpointItem[],
  nextCheckpoints: CheckpointItem[],
): Promise<void> {
  const path = `projects/${projectId}/checkpoints`;
  try {
    const batch = writeBatch(db);
    const prevIds = new Set(prevCheckpoints.map((c) => c.id));
    const nextIds = new Set(nextCheckpoints.map((c) => c.id));

    nextCheckpoints.forEach((cp) => {
      if (!prevIds.has(cp.id)) {
        batch.set(doc(db, path, cp.id), {
          projectId,
          ownerId: uid,
          ...checkpointFields(cp),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const prev = prevCheckpoints.find((c) => c.id === cp.id);
        if (prev && JSON.stringify(checkpointFields(prev)) !== JSON.stringify(checkpointFields(cp))) {
          batch.update(doc(db, path, cp.id), {
            ...checkpointFields(cp),
            updatedAt: serverTimestamp(),
          });
        }
      }
    });

    prevCheckpoints.forEach((cp) => {
      if (!nextIds.has(cp.id)) {
        batch.delete(doc(db, path, cp.id));
      }
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function addRevisionInDb(
  uid: string,
  projectId: string,
  revision: PlanRevision,
): Promise<void> {
  const revPath = `projects/${projectId}/revisions/${revision.id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, `projects/${projectId}/revisions`, revision.id), {
      projectId,
      ownerId: uid,
      version: revision.version.slice(0, 32),
      title: revision.title.slice(0, 200),
      createdAtLabel: revision.createdAt.slice(0, 40),
      author: revision.author.slice(0, 80),
      category: revision.category,
      reason: revision.reason.slice(0, 2000),
      impactSummary: revision.impactSummary.slice(0, 1000),
      snapshotPhases: sanitizePhases(revision.snapshotPhases),
      createdAt: serverTimestamp(),
    });

    revision.snapshotTasks.forEach((st, idx) => {
      const stRef = doc(db, `${revPath}/snapshotTasks`, st.id);
      batch.set(stRef, sanitizeTaskPayload(st, projectId, uid, idx, true));
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, revPath);
  }
}

export async function deleteProjectInDb(uid: string, projectId: string): Promise<void> {
  const projectPath = `projects/${projectId}`;
  try {
    // Delete subcollection documents while parent project still exists for Master Gate rules
    const batch = writeBatch(db);

    const tasksSnap = await getDocs(
      query(collection(db, `${projectPath}/tasks`), where('ownerId', '==', uid)),
    );
    tasksSnap.docs.forEach((d) => batch.delete(d.ref));

    const cpSnap = await getDocs(
      query(collection(db, `${projectPath}/checkpoints`), where('ownerId', '==', uid)),
    );
    cpSnap.docs.forEach((d) => batch.delete(d.ref));

    const revSnap = await getDocs(
      query(collection(db, `${projectPath}/revisions`), where('ownerId', '==', uid)),
    );
    for (const rDoc of revSnap.docs) {
      const snapTasks = await getDocs(
        query(
          collection(db, `${projectPath}/revisions/${rDoc.id}/snapshotTasks`),
          where('ownerId', '==', uid),
        ),
      );
      snapTasks.docs.forEach((sd) => batch.delete(sd.ref));
      batch.delete(rDoc.ref);
    }

    await batch.commit();
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, projectPath);
  }
}
