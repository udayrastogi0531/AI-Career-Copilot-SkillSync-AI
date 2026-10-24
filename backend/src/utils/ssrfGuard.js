import dns from "node:dns/promises";
import net from "node:net";

export class SafeFetchError extends Error {
  constructor(message, code = "UNSAFE_URL", statusCode = 400) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "instance-data.ec2.internal"
]);

const ipv4ToInt = (ip) => {
  const parts = String(ip).split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
};

const isPrivateIpv4 = (ip) => {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  const ranges = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4]
  ];

  for (const [base, bits] of ranges) {
    const baseValue = ipv4ToInt(base);
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((value & mask) === (baseValue & mask)) return true;
  }

  // Cloud metadata services.
  if (value === ipv4ToInt("169.254.169.254") || value === ipv4ToInt("100.100.100.200")) return true;

  return false;
};

const expandIpv6 = (ip) => {
  let value = String(ip).toLowerCase().split("%")[0];
  if (!value.includes(":")) return null;

  // Collapse a trailing dotted quad (::ffff:127.0.0.1) into two hex groups so
  // the group count is correct before zero-padding.
  const dotted = value.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const octets = dotted[1].split(".").map(Number);
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    value = `${value.slice(0, dotted.index)}${high}:${low}`;
  }

  const [headRaw, tailRaw] = value.includes("::") ? value.split("::") : [value, null];
  const head = headRaw ? headRaw.split(":").filter(Boolean) : [];
  const tail = tailRaw ? tailRaw.split(":").filter(Boolean) : [];

  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;

  const parts = [...head, ...Array(missing).fill("0"), ...tail];
  if (parts.length !== 8) return null;

  const numbers = parts.map((part) => parseInt(part || "0", 16));
  if (numbers.some((num) => Number.isNaN(num) || num < 0 || num > 0xffff)) return null;
  return numbers;
};

const isPrivateIpv6 = (ip) => {
  const parts = expandIpv6(ip);
  if (!parts) return true;

  // IPv4-mapped ::ffff:a.b.c.d
  if (parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff) {
    const v4 = `${parts[6] >> 8}.${parts[6] & 0xff}.${parts[7] >> 8}.${parts[7] & 0xff}`;
    return isPrivateIpv4(v4);
  }

  if (parts.every((part) => part === 0)) return true; // ::
  if (parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) return true; // ::1
  if ((parts[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((parts[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((parts[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (parts[0] === 0x2001 && parts[1] === 0x0db8) return true; // documentation

  return false;
};

export const isPrivateAddress = (address) => {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
};

const normalizeUrl = (input) => {
  const value = String(input || "").trim();
  if (!value) throw new SafeFetchError("A job posting URL is required.", "URL_REQUIRED");

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new SafeFetchError("That is not a valid URL. Include https:// or http://.", "INVALID_URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new SafeFetchError("Only http and https URLs are supported.", "UNSUPPORTED_PROTOCOL");
  }
  if (parsed.username || parsed.password) {
    throw new SafeFetchError("URLs with embedded credentials are not allowed.", "URL_CREDENTIALS");
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  if (![80, 443].includes(port)) {
    throw new SafeFetchError("Only default HTTP/HTTPS ports are allowed.", "UNSUPPORTED_PORT");
  }

  parsed.hash = "";
  return parsed;
};

const parseHostLiteral = (hostname) => {
  const unbracketed = hostname.replace(/^\[|\]$/g, "");
  return net.isIP(unbracketed) ? unbracketed : "";
};

/**
 * Resolve and validate a URL. Resolved addresses are returned so the HTTP
 * client can pin them and avoid DNS-rebinding between check and request.
 */
export const assertSafeUrl = async (input) => {
  const parsed = normalizeUrl(input);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new SafeFetchError("That hostname is not allowed for job fetching.", "BLOCKED_HOST");
  }

  const literal = parseHostLiteral(hostname);
  let addresses;
  if (literal) {
    addresses = [{ address: literal, family: net.isIP(literal) }];
  } else {
    try {
      addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new SafeFetchError("Could not resolve that job posting host.", "DNS_FAILED", 422);
    }
  }

  if (!addresses.length) {
    throw new SafeFetchError("Could not resolve that job posting host.", "DNS_FAILED", 422);
  }

  const privateAddress = addresses.find((entry) => isPrivateAddress(entry.address));
  if (privateAddress) {
    throw new SafeFetchError("That URL resolves to a private or internal address and was blocked.", "PRIVATE_ADDRESS");
  }

  return {
    url: parsed.toString(),
    hostname,
    addresses
  };
};

/**
 * Make a DNS lookup function that only returns addresses already validated by
 * assertSafeUrl. Pass it to the HTTP client's `lookup` option.
 */
export const createPinnedLookup = (addresses) => {
  const list = addresses.map((entry) => ({ address: entry.address, family: entry.family }));
  return (hostname, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    const wantsAll = Boolean(options?.all);
    if (wantsAll) {
      callback(null, list);
      return;
    }
    callback(null, list[0].address, list[0].family);
  };
};
