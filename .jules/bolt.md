## 2024-06-19 - Fast distinct roots in MutationObserver
**Learning:** `getDistinctRoots` runs synchronously in the hot path of the MutationObserver callback. Using higher-order array methods (`Array.filter` + `Array.some`) and arrow functions inside this callback creates unnecessary overhead (O(n^2) allocations/invocations).
**Action:** Replace `Array.filter` + `Array.some` with manual nested `for` loops in hot path MutationObserver callbacks to significantly reduce execution overhead and improve application responsiveness. Manual loops are typically ~3-4x faster for simple iterations in JS.
