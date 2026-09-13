// filepath: extension/src/roles/detect-engine.ts
/**
 * ============================================================================
 * DETECT ENGINE ROLE — detection output published on the page bus
 * ============================================================================
 *
 * Spec: extension/docs/ENGINE_V4_SYSTEM_DESIGN.md §4, §9 (S5 "roles behind
 * the bus"). This is the first role module: instead of callers reaching into
 * an engine directly, the role reads detection state and publishes topics.
 *
 * Contract:
 * - Delegation only. No DOM, no globals, no logic beyond the FileNode →
 *   FileRef mapping the topic payload requires (contracts/topics.ts).
 * - 'post:scanned' carries the source's tracked posts array verbatim (same
 *   reference — no copy, no reshape).
 * - One 'file:discovered' per post that has files, with the post's FileNode[]
 *   projected to the bridge-safe FileRef shape (fileId/url/ext/name;
 *   element/idSource are intentionally dropped — DOM + derivation details).
 * - Fault model (§9): the bus boundary is the fault boundary, so publishing
 *   needs no try/catch here — a throwing subscriber is isolated by the bus
 *   and reported via onError. Reading the SOURCE, however, happens inside
 *   this role: a source throw is isolated — caught, rethrown as nothing,
 *   nothing published that cycle. The next cycle reads again.
 */
import type { EventBus } from '../bus/event-bus';
import type { FileRef, PageTopicMap } from '../contracts/topics';
import type { FileNode, PostNode } from '../engines/types';

/** What DetectEngine reads. Any engine exposing its tracked posts qualifies. */
export interface DetectSource {
  getTrackedPosts(): PostNode[];
}

export class DetectEngine {
  constructor(
    private readonly bus: EventBus<PageTopicMap>,
    private readonly source: DetectSource,
  ) {}

  /** Call once after a scan cycle settles. Reads the source VERBATIM. */
  onScanComplete(): void {
    let posts: PostNode[];
    try {
      posts = this.source.getTrackedPosts();
    } catch {
      // Source throw is isolated: report nothing (nothing to publish it
      // against), publish nothing this cycle, never escape to the caller.
      return;
    }

    this.bus.publish('post:scanned', { posts });

    for (const post of posts) {
      if (post.files.length === 0) continue;
      this.bus.publish('file:discovered', {
        postId: post.id,
        files: post.files.map(toFileRef),
      });
    }
  }
}

/** The bridge-safe projection of a FileNode (contracts/topics.ts FileRef). */
function toFileRef(node: FileNode): FileRef {
  return {
    fileId: node.canonicalId,
    url: node.downloadUrl,
    ext: node.ext,
    name: node.name,
  };
}
