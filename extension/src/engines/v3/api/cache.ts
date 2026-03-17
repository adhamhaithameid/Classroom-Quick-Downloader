import type { ClassroomApiSnapshot } from './types';

export class ClassroomApiSnapshotCache {
  private ttlMs: number;
  private store = new Map<string, ClassroomApiSnapshot>();

  constructor(ttlMs = 90_000) {
    this.ttlMs = ttlMs;
  }

  get(key: string): ClassroomApiSnapshot | null {
    const snapshot = this.store.get(key);
    if (!snapshot) return null;
    if (Date.now() - snapshot.fetchedAt > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return snapshot;
  }

  set(key: string, snapshot: ClassroomApiSnapshot): void {
    this.store.set(key, snapshot);
  }

  clear(): void {
    this.store.clear();
  }
}
