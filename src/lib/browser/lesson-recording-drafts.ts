"use client";

const DB_NAME = "practice-loop-recording-drafts";
const DB_VERSION = 1;
const DRAFT_STORE = "lesson-recording-drafts";
const CHUNK_STORE = "lesson-recording-chunks";
const CHUNK_DRAFT_INDEX = "draftId";
const IDB_OPEN_TIMEOUT_MS = 5000;
const IDB_OPERATION_TIMEOUT_MS = 10000;

export type LessonRecordingDraft = {
  id: string;
  chunkCount: number;
  createdAt: string;
  durationSeconds?: number;
  deviceCopyFileName?: string;
  lessonDate: string;
  lessonId?: string;
  mimeType: string;
  serverUploadId?: string;
  startedAt: string;
  summary: string;
  teacher: string;
  title: string;
  updatedAt: string;
};

export type LessonRecordingChunk = {
  id: string;
  blob: Blob;
  createdAt: string;
  draftId: string;
  index: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: number | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return withTimeout(
    new Promise<T>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    }),
    IDB_OPERATION_TIMEOUT_MS,
    "Browser recording storage did not respond.",
  );
}

function transactionDone(transaction: IDBTransaction) {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    }),
    IDB_OPERATION_TIMEOUT_MS,
    "Browser recording storage did not finish.",
  );
}

function openDraftDb() {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  if (dbPromise) return dbPromise;

  dbPromise = withTimeout(
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          db.createObjectStore(DRAFT_STORE, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(CHUNK_STORE)) {
          const chunkStore = db.createObjectStore(CHUNK_STORE, { keyPath: "id" });
          chunkStore.createIndex(CHUNK_DRAFT_INDEX, "draftId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
    }),
    IDB_OPEN_TIMEOUT_MS,
    "Browser recording storage did not open.",
  ).catch((error) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

export function lessonRecordingDraftStorageAvailable() {
  return hasIndexedDb();
}

export async function requestPersistentRecordingStorage() {
  try {
    if (!navigator.storage?.persist) return false;

    return await withTimeout(
      navigator.storage.persist(),
      IDB_OPEN_TIMEOUT_MS,
      "Persistent storage prompt did not finish.",
    );
  } catch {
    return false;
  }
}

export async function saveLessonRecordingDraft(draft: LessonRecordingDraft) {
  const db = await openDraftDb();
  const transaction = db.transaction(DRAFT_STORE, "readwrite");
  const done = transactionDone(transaction);

  transaction.objectStore(DRAFT_STORE).put(draft);
  await done;
}

export async function updateLessonRecordingDraft(
  draftId: string,
  patch: Partial<LessonRecordingDraft>,
) {
  const db = await openDraftDb();
  const transaction = db.transaction(DRAFT_STORE, "readwrite");
  const done = transactionDone(transaction);
  const draftStore = transaction.objectStore(DRAFT_STORE);
  const request = draftStore.get(draftId);

  request.onsuccess = () => {
    const draft = request.result as LessonRecordingDraft | undefined;

    if (!draft) return;

    draftStore.put({
      ...draft,
      ...patch,
      id: draft.id,
      updatedAt: new Date().toISOString(),
    });
  };

  await done;
}

export async function saveLessonRecordingChunk({
  blob,
  draftId,
  index,
}: {
  blob: Blob;
  draftId: string;
  index: number;
}) {
  const db = await openDraftDb();
  const transaction = db.transaction(CHUNK_STORE, "readwrite");
  const done = transactionDone(transaction);
  const now = new Date().toISOString();

  transaction.objectStore(CHUNK_STORE).put({
    blob,
    createdAt: now,
    draftId,
    id: `${draftId}:${String(index).padStart(8, "0")}`,
    index,
  } satisfies LessonRecordingChunk);

  await done;

  const progressTransaction = db.transaction(DRAFT_STORE, "readwrite");
  const progressDone = transactionDone(progressTransaction);
  const draftStore = progressTransaction.objectStore(DRAFT_STORE);
  const draftRequest = draftStore.get(draftId);

  draftRequest.onsuccess = () => {
    const draft = draftRequest.result as LessonRecordingDraft | undefined;

    if (!draft) return;

    draftStore.put({
      ...draft,
      chunkCount: Math.max(draft.chunkCount, index + 1),
      updatedAt: now,
    });
  };

  await progressDone;
}

export async function listLessonRecordingDrafts() {
  const db = await openDraftDb();
  const transaction = db.transaction(DRAFT_STORE, "readonly");
  const done = transactionDone(transaction);
  const drafts = await requestResult<LessonRecordingDraft[]>(
    transaction.objectStore(DRAFT_STORE).getAll(),
  );
  await done;

  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadLessonRecordingDraft(draftId: string) {
  const db = await openDraftDb();
  const transaction = db.transaction([DRAFT_STORE, CHUNK_STORE], "readonly");
  const done = transactionDone(transaction);
  const draftRequest = transaction.objectStore(DRAFT_STORE).get(draftId);
  const chunksRequest = transaction
    .objectStore(CHUNK_STORE)
    .index(CHUNK_DRAFT_INDEX)
    .getAll(IDBKeyRange.only(draftId));
  const draft = await requestResult<LessonRecordingDraft | undefined>(
    draftRequest,
  );
  const chunks = await requestResult<LessonRecordingChunk[]>(
    chunksRequest,
  );

  await done;

  return {
    chunks: chunks.sort((a, b) => a.index - b.index),
    draft,
  };
}

export async function deleteLessonRecordingDraft(draftId: string) {
  const db = await openDraftDb();
  const transaction = db.transaction([DRAFT_STORE, CHUNK_STORE], "readwrite");
  const done = transactionDone(transaction);
  const draftStore = transaction.objectStore(DRAFT_STORE);
  const chunkIndex = transaction
    .objectStore(CHUNK_STORE)
    .index(CHUNK_DRAFT_INDEX);

  draftStore.delete(draftId);
  const cursorRequest = chunkIndex.openCursor(IDBKeyRange.only(draftId));

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;

    if (!cursor) return;

    cursor.delete();
    cursor.continue();
  };

  await done;
}
