import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { LoggedFoodItem } from '../types/nutrition';
import { enforceDailyItemLimit, sanitizeFoodEntryForStorage } from '../utils/nutrition';

const LOCAL_STORAGE_PREFIX = 'nutrilog:day:';

export function readLocalDayItems(date: string): LoggedFoodItem[] {
  try {
    const raw = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${date}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return enforceDailyItemLimit(parsed as LoggedFoodItem[]);
  } catch {
    return [];
  }
}

export function readLocalRangeItems(dates: string[]): Record<string, LoggedFoodItem[]> {
  const result: Record<string, LoggedFoodItem[]> = {};
  for (const date of dates) {
    const items = readLocalDayItems(date);
    if (items.length > 0) {
      result[date] = items;
    }
  }
  return result;
}

export function writeLocalDayItems(date: string, items: LoggedFoodItem[]): void {
  try {
    const safeItems = enforceDailyItemLimit(items);
    if (safeItems.length === 0) {
      window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${date}`);
    } else {
      window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${date}`, JSON.stringify(safeItems));
    }
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function subscribeUserDayLog(
  uid: string,
  date: string,
  onData: (items: LoggedFoodItem[], fromCache: boolean) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const docPath = `users/${uid}/logs/${date}`;
  const docRef = doc(db, 'users', uid, 'logs', date);

  return onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists()) {
        onData([], snapshot.metadata.fromCache);
        return;
      }
      const data = snapshot.data() as { items?: unknown };
      const rawItems = Array.isArray(data.items) ? (data.items as LoggedFoodItem[]) : [];
      onData(enforceDailyItemLimit(rawItems), snapshot.metadata.fromCache);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeUserLogsMap(
  uid: string,
  onData: (logsByDate: Record<string, LoggedFoodItem[]>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const collectionPath = `users/${uid}/logs`;
  const logsQuery = query(
    collection(db, 'users', uid, 'logs'),
    where('userId', '==', uid)
  );

  return onSnapshot(
    logsQuery,
    (snapshot) => {
      const nextMap: Record<string, LoggedFoodItem[]> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as { date?: unknown; items?: unknown };
        const dateKey = typeof data.date === 'string' ? data.date : docSnap.id;
        const rawItems = Array.isArray(data.items) ? (data.items as LoggedFoodItem[]) : [];
        if (rawItems.length > 0) {
          nextMap[dateKey] = enforceDailyItemLimit(rawItems);
        }
      });
      onData(nextMap);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function readUserDayLog(uid: string, date: string): Promise<LoggedFoodItem[]> {
  const docPath = `users/${uid}/logs/${date}`;
  const docRef = doc(db, 'users', uid, 'logs', date);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return [];
    const data = snap.data() as { items?: unknown };
    const rawItems = Array.isArray(data.items) ? (data.items as LoggedFoodItem[]) : [];
    return enforceDailyItemLimit(rawItems);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function saveUserDayLog(
  uid: string,
  date: string,
  items: LoggedFoodItem[]
): Promise<void> {
  const docPath = `users/${uid}/logs/${date}`;
  const docRef = doc(db, 'users', uid, 'logs', date);
  const safeItems = enforceDailyItemLimit(items).map(sanitizeFoodEntryForStorage);

  try {
    if (safeItems.length === 0) {
      await deleteDoc(docRef);
      return;
    }
    await setDoc(docRef, {
      userId: uid,
      date,
      items: safeItems,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}
