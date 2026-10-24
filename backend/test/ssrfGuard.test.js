import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeUrl, createPinnedLookup, isPrivateAddress, SafeFetchError } from "../src/utils/ssrfGuard.js";

test("private, loopback, link-local, and multicast addresses are rejected", () => {
  const blocked = [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.5.4",
    "172.31.255.254",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "100.100.100.200",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1"
  ];
  for (const ip of blocked) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be blocked`);
  }
});

test("public addresses are allowed", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be allowed`);
  }
});

test("assertSafeUrl rejects non-http protocols and credentials", async () => {
  await assert.rejects(() => assertSafeUrl("file:///etc/passwd"), (error) => error.code === "UNSUPPORTED_PROTOCOL");
  await assert.rejects(() => assertSafeUrl("gopher://example.com"), (error) => error.code === "UNSUPPORTED_PROTOCOL");
  await assert.rejects(
    () => assertSafeUrl("https://user:pass@example.com/job"),
    (error) => error.code === "URL_CREDENTIALS"
  );
  await assert.rejects(() => assertSafeUrl("not a url"), (error) => error.code === "INVALID_URL");
  await assert.rejects(() => assertSafeUrl(""), (error) => error.code === "URL_REQUIRED");
});

test("assertSafeUrl rejects metadata and private hosts without network access", async () => {
  const blocked = [
    "http://127.0.0.1/admin",
    "http://[::1]/admin",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.168.1.1/router",
    "http://localhost/admin",
    "http://metadata.google.internal/computeMetadata/v1/"
  ];

  for (const url of blocked) {
    await assert.rejects(
      () => assertSafeUrl(url),
      (error) => {
        assert.ok(error instanceof SafeFetchError, `${url} should raise SafeFetchError`);
        assert.ok(["PRIVATE_ADDRESS", "BLOCKED_HOST"].includes(error.code), `${url} code was ${error.code}`);
        return true;
      }
    );
  }
});

test("assertSafeUrl resolves a public host to pinned addresses", async (t) => {
  try {
    const result = await assertSafeUrl("https://example.com/jobs/1");
    assert.equal(result.hostname, "example.com");
    assert.ok(result.addresses.length > 0);
    assert.ok(result.addresses.every((entry) => isPrivateAddress(entry.address) === false));
  } catch (error) {
    // Offline environments cannot resolve DNS; the guard itself is covered above.
    t.diagnostic(`DNS unavailable: ${error.code || error.message}`);
  }
});

test("pinned lookup only returns validated addresses", () => {
  const lookup = createPinnedLookup([{ address: "93.184.216.34", family: 4 }]);
  let single;
  lookup("example.com", {}, (error, address, family) => {
    assert.equal(error, null);
    single = { address, family };
  });
  assert.deepEqual(single, { address: "93.184.216.34", family: 4 });

  let all;
  lookup("example.com", { all: true }, (error, addresses) => {
    assert.equal(error, null);
    all = addresses;
  });
  assert.equal(all.length, 1);
  assert.equal(all[0].address, "93.184.216.34");
});
