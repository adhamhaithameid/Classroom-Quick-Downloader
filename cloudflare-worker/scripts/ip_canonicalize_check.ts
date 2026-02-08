#!/usr/bin/env node
/**
 * IP Canonicalization Test Script
 * Uses production canonicalizeIp implementation to avoid drift.
 *
 * Run with: npx tsx scripts/ip_canonicalize_check.ts
 */

import { canonicalizeIp } from "../src/ip_utils";

interface TestCase {
  input: string;
  expected: string | null;
  description: string;
}

const testCases: TestCase[] = [
  // Pure IPv4
  { input: "192.168.1.1", expected: "192.168.1.1", description: "Pure IPv4" },
  { input: "127.0.0.1", expected: "127.0.0.1", description: "Loopback IPv4" },

  // IPv6 loopback
  { input: "::1", expected: "::1", description: "IPv6 loopback" },
  { input: "::", expected: "::", description: "IPv6 any address" },

  // IPv6 with compression
  { input: "2001:db8::1", expected: "2001:db8::1", description: "IPv6 with compression" },
  { input: "2001:db8:0:0:0:0:0:1", expected: "2001:db8::1", description: "IPv6 full form → compressed" },
  { input: "2001:0db8:0000:0000:0000:0000:0000:0001", expected: "2001:db8::1", description: "IPv6 padded zeros" },

  // Embedded IPv4 - should collapse to pure IPv4
  { input: "::ffff:192.168.1.1", expected: "192.168.1.1", description: "IPv4-mapped (::ffff:) → pure IPv4" },
  { input: "::192.0.2.1", expected: "192.0.2.1", description: "IPv4-compatible (::) → pure IPv4" },
  { input: "0:0:0:0:0:0:192.0.2.1", expected: "192.0.2.1", description: "IPv4-compatible full prefix → pure IPv4" },
  { input: "0:0:0:0:0:ffff:192.0.2.1", expected: "192.0.2.1", description: "IPv4-mapped full prefix → pure IPv4" },

  // Embedded IPv4 with real prefix - should convert to hextets
  { input: "2001:db8::192.0.2.1", expected: "2001:db8::c000:201", description: "Embedded IPv4 with prefix → hextets" },

  // Invalid cases
  { input: "::1:", expected: null, description: "Trailing colon (INVALID)" },
  { input: ":2001:db8::1", expected: null, description: "Leading single colon (INVALID)" },
  { input: "2001:db8::1:", expected: null, description: "Trailing colon after valid IPv6 (INVALID)" },
  { input: "2001:::1", expected: null, description: "Triple-colon in middle (INVALID)" },
  { input: ":::", expected: null, description: "Triple-colon only (INVALID)" },
  { input: "unknown", expected: null, description: "Unknown string (INVALID)" },
  { input: "", expected: null, description: "Empty string (INVALID)" },
];

console.log("=".repeat(60));
console.log("IP Canonicalization Test Suite");
console.log("=".repeat(60));
console.log();

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = canonicalizeIp(tc.input);
  const success = result === tc.expected;

  if (success) {
    passed++;
    console.log(`PASS: ${tc.description}`);
    console.log(`  Input:    "${tc.input}"`);
    console.log(`  Output:   "${result}"`);
  } else {
    failed++;
    console.log(`FAIL: ${tc.description}`);
    console.log(`  Input:    "${tc.input}"`);
    console.log(`  Expected: "${tc.expected}"`);
    console.log(`  Got:      "${result}"`);
  }
  console.log();
}

console.log("=".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exitCode = 1;
}
