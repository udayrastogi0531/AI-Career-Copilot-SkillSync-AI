import test from "node:test";
import assert from "node:assert/strict";
import { fetchJobFromUrl } from "../src/services/jobFetchService.js";

const expectCode = async (url, codes) => {
  await assert.rejects(
    () => fetchJobFromUrl(url),
    (error) => {
      assert.ok(codes.includes(error.code), `expected one of ${codes.join(", ")} but received ${error.code}`);
      assert.ok(error.statusCode >= 400);
      return true;
    }
  );
};

test("blocks loopback, private, and metadata URLs before fetching", async () => {
  await expectCode("http://127.0.0.1:80/jobs", ["PRIVATE_ADDRESS", "BLOCKED_HOST"]);
  await expectCode("http://localhost/jobs", ["PRIVATE_ADDRESS", "BLOCKED_HOST"]);
  await expectCode("http://169.254.169.254/latest/meta-data/", ["PRIVATE_ADDRESS", "BLOCKED_HOST"]);
  await expectCode("http://[::1]/jobs", ["PRIVATE_ADDRESS", "BLOCKED_HOST"]);
  await expectCode("http://10.0.0.5/jobs", ["PRIVATE_ADDRESS", "BLOCKED_HOST"]);
});

test("rejects unsupported protocols and odd ports", async () => {
  await expectCode("file:///etc/passwd", ["UNSUPPORTED_PROTOCOL"]);
  await expectCode("https://example.com:8443/jobs", ["UNSUPPORTED_PORT"]);
  await expectCode("https://user:secret@example.com/jobs", ["URL_CREDENTIALS"]);
});
