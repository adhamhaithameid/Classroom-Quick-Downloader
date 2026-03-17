import type {
  ClassroomApiClient,
  ClassroomApiRouteContext,
  ClassroomApiSnapshot,
} from './types';
import { ClassroomApiSnapshotCache } from './cache';
import { GoogleClassroomApiClient } from './classroom-api-client';
import { ChromeIdentityTokenProvider } from './token-provider';

export interface ApiDiscoveryOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export interface ApiDiscoveryService {
  discover(
    context: ClassroomApiRouteContext,
    options?: ApiDiscoveryOptions,
  ): Promise<ClassroomApiSnapshot | null>;
  clear(): void;
}

export class ClassroomApiDiscoveryService implements ApiDiscoveryService {
  private client: ClassroomApiClient;
  private cache: ClassroomApiSnapshotCache;

  constructor(
    client: ClassroomApiClient,
    cache: ClassroomApiSnapshotCache = new ClassroomApiSnapshotCache(),
  ) {
    this.client = client;
    this.cache = cache;
  }

  async discover(
    context: ClassroomApiRouteContext,
    options: ApiDiscoveryOptions = {},
  ): Promise<ClassroomApiSnapshot | null> {
    const cacheKey = `${context.courseId}:${context.courseWorkId}:${context.studentSubmissionId || 'all'}`;
    if (!options.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const submissions = await this.client.fetchStudentSubmissions(context, options.signal);
    const snapshot: ClassroomApiSnapshot = {
      fetchedAt: Date.now(),
      context,
      submissions,
    };
    this.cache.set(cacheKey, snapshot);
    return snapshot;
  }

  clear(): void {
    this.cache.clear();
  }
}

export function createDefaultApiDiscoveryService(): ApiDiscoveryService {
  const tokenProvider = new ChromeIdentityTokenProvider();
  const client = new GoogleClassroomApiClient(tokenProvider);
  const cache = new ClassroomApiSnapshotCache();
  return new ClassroomApiDiscoveryService(client, cache);
}
