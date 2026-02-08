// IP validation and canonicalization utilities shared across worker modules.

/**
 * Validates IPv4 address with strict octet checking (0-255).
 * Rejects malformed strings like 999.1.1.1
 */
export function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) return false;
    if (part.length > 1 && part[0] === "0") return false;
  }
  return true;
}

/**
 * Validates IPv6 hextet structure with compression support.
 * @param ip - The IPv6 address string
 * @param maxHextets - Maximum allowed hextets (8 for pure IPv6, 6 for IPv4-mapped)
 */
export function isValidIpv6Hextets(ip: string, maxHextets: number): boolean {
  const hextetPattern = /^[0-9a-fA-F]{1,4}$/;

  // Reject trailing/leading single colons (except for :: itself)
  if (ip !== "::") {
    if (ip.endsWith(":") && !ip.endsWith("::")) return false;
    if (ip.startsWith(":") && !ip.startsWith("::")) return false;
  }

  const hasCompression = ip.includes("::");

  if (hasCompression) {
    if ((ip.match(/::/g) || []).length > 1) return false;
    const parts = ip.split("::");
    if (parts.length !== 2) return false;

    const left = parts[0] ? parts[0].split(":") : [];
    const right = parts[1] ? parts[1].split(":") : [];

    for (const h of left) {
      if (h === "") return false;
      if (!hextetPattern.test(h)) return false;
    }
    for (const h of right) {
      if (h === "") return false;
      if (!hextetPattern.test(h)) return false;
    }

    const totalHextets = left.length + right.length;
    return totalHextets < maxHextets;
  } else {
    const hextets = ip.split(":");
    if (hextets.length !== maxHextets) return false;
    for (const h of hextets) {
      if (!hextetPattern.test(h)) return false;
    }
    return true;
  }
}

/**
 * Protocol-complete IPv6 validation with hextet counting.
 * Supports: full form, zero-compression (::), embedded IPv4, loopback (::1).
 */
export function isValidIpv6(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;

  if (ip.includes(".")) {
    if (ip.startsWith(":") && !ip.startsWith("::")) return false;

    const lastColon = ip.lastIndexOf(":");
    if (lastColon === -1) return false;

    const ipv4Part = ip.slice(lastColon + 1);
    if (!isValidIpv4(ipv4Part)) return false;

    const rawPrefix = ip.slice(0, lastColon);
    if (rawPrefix === ":") return true;

    const hasCompression = ip.charAt(lastColon - 1) === ":";
    const prefixToValidate = hasCompression ? rawPrefix + ":" : rawPrefix;

    if (prefixToValidate === "" || prefixToValidate === ":" || prefixToValidate === "::") {
      return true;
    }

    return isValidIpv6Hextets(prefixToValidate, 6);
  }

  return isValidIpv6Hextets(ip, 8);
}

/**
 * Validates if a string is a valid IPv4 or IPv6 address.
 * Filters out "unknown", empty strings, and malformed IPs.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || ip === "unknown") return false;
  return isValidIpv4(ip) || isValidIpv6(ip);
}

function expandIpv6ToHextets(ip: string): string[] | null {
  const hextetPattern = /^[0-9a-fA-F]{1,4}$/;

  if (ip.includes("::")) {
    if ((ip.match(/::/g) || []).length > 1) return null;
    const parts = ip.split("::");
    if (parts.length !== 2) return null;

    const left = parts[0] ? parts[0].split(":") : [];
    const right = parts[1] ? parts[1].split(":") : [];

    for (const h of left) {
      if (h === "" || !hextetPattern.test(h)) return null;
    }
    for (const h of right) {
      if (h === "" || !hextetPattern.test(h)) return null;
    }

    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    const zeros = Array(missing).fill("0");
    return [...left, ...zeros, ...right].map((h) => (parseInt(h, 16) || 0).toString(16));
  }

  const hextets = ip.split(":");
  if (hextets.length !== 8) return null;
  for (const h of hextets) {
    if (!hextetPattern.test(h)) return null;
  }
  return hextets.map((h) => (parseInt(h, 16) || 0).toString(16));
}

function compressIpv6Hextets(hextets: string[]): string {
  let maxStart = -1;
  let maxLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < hextets.length; i++) {
    if (hextets[i] === "0") {
      if (curStart === -1) curStart = i;
      curLen++;
    } else {
      if (curLen > maxLen) {
        maxStart = curStart;
        maxLen = curLen;
      }
      curStart = -1;
      curLen = 0;
    }
  }
  if (curLen > maxLen) {
    maxStart = curStart;
    maxLen = curLen;
  }

  if (maxLen >= 2) {
    const before = hextets.slice(0, maxStart).join(":");
    const after = hextets.slice(maxStart + maxLen).join(":");
    if (maxStart === 0 && maxLen === 8) return "::";
    if (maxStart === 0) return "::" + after;
    if (maxStart + maxLen === 8) return before + "::";
    return before + "::" + after;
  }

  return hextets.join(":");
}

/**
 * Canonicalizes an IP address to a standard format.
 * IPv4: unchanged if valid
 * IPv6: expands to full form, then compresses optimally (like Go's net.ParseIP().String())
 * Returns null if invalid.
 */
export function canonicalizeIp(ip: string): string | null {
  if (!ip || ip === "unknown") return null;

  if (isValidIpv4(ip)) {
    return ip;
  }

  if (!isValidIpv6(ip)) return null;

  try {
    if (ip.includes(".")) {
      const lastColon = ip.lastIndexOf(":");
      if (lastColon === -1) return null;

      const ipv4Part = ip.slice(lastColon + 1);
      if (!isValidIpv4(ipv4Part)) return null;

      const ipv4Parts = ipv4Part.split(".").map((p) => parseInt(p, 10));
      const hextet1 = ((ipv4Parts[0] << 8) | ipv4Parts[1]).toString(16);
      const hextet2 = ((ipv4Parts[2] << 8) | ipv4Parts[3]).toString(16);

      const prefix = ip.slice(0, lastColon + 1);
      const fullIpv6 = prefix + hextet1 + ":" + hextet2;

      const hextets = expandIpv6ToHextets(fullIpv6);
      if (!hextets) return null;

      const isCompat = hextets.slice(0, 6).every((h) => h === "0");
      const isMapped =
        hextets.slice(0, 5).every((h) => h === "0") && hextets[5] === "ffff";

      if (isCompat || isMapped) {
        return ipv4Part;
      }

      return compressIpv6Hextets(hextets);
    }

    const hextets = expandIpv6ToHextets(ip);
    if (!hextets) return null;
    return compressIpv6Hextets(hextets);
  } catch {
    return ip.toLowerCase();
  }
}
