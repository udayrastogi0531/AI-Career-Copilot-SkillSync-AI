import test from "node:test";
import assert from "node:assert/strict";
import { getMongoHosts } from "../src/config/db.js";

test("credential-less host is parsed in full", () => {
  // Regression: a greedy regex read this host as "l", producing a bogus DNS
  // lookup failure for a perfectly valid local connection string.
  assert.deepEqual(getMongoHosts("mongodb://127.0.0.1:27017/skillsync_local"), ["127.0.0.1"]);
  assert.deepEqual(getMongoHosts("mongodb://localhost:27017/career_copilot"), ["localhost"]);
});

test("credentials are stripped, including passwords containing @ and :", () => {
  assert.deepEqual(
    getMongoHosts("mongodb+srv://app:p%40ss%3Aword@cluster0.abcde.mongodb.net/career?retryWrites=true"),
    ["cluster0.abcde.mongodb.net"]
  );
  assert.deepEqual(
    getMongoHosts("mongodb://app:p@ss@cluster0.abcde.mongodb.net:27017/db"),
    ["cluster0.abcde.mongodb.net"]
  );
});

test("every seed host of a multi-host replica set is returned", () => {
  assert.deepEqual(
    getMongoHosts(
      "mongodb://app:secret@ac-abc-shard-00-00.x.mongodb.net:27017,ac-abc-shard-00-01.x.mongodb.net:27017,ac-abc-shard-00-02.x.mongodb.net:27017/db?ssl=true&replicaSet=atlas-shard-0"
    ),
    ["ac-abc-shard-00-00.x.mongodb.net", "ac-abc-shard-00-01.x.mongodb.net", "ac-abc-shard-00-02.x.mongodb.net"]
  );
});

test("IPv6 literals keep their address so they are recognised as IPs", () => {
  assert.deepEqual(getMongoHosts("mongodb://[::1]:27017/db"), ["::1"]);
});

test("malformed or empty input yields no hosts", () => {
  assert.deepEqual(getMongoHosts(""), []);
  assert.deepEqual(getMongoHosts(undefined), []);
  assert.deepEqual(getMongoHosts("https://example.com"), []);
});
