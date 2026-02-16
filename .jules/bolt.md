## 2026-02-16 - Durable Object Batch Processing Optimization
**Learning:** Dense data processing logic (like batch aggregation) inside Durable Objects can easily become a CPU bottleneck if O(n) passes are multiplied. Merging multiple passes into a single loop for array processing (reduction, aggregation, max/min calculation) not only saves CPU cycles but also simplifies the code structure.
**Action:** When implementing aggregation logic for large datasets (e.g., 10k+ items), always aim for a single-pass implementation. Explicitly map out input traversals and merge them where possible.
