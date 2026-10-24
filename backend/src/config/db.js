import dns from "node:dns/promises";
import net from "node:net";
import mongoose from "mongoose";
import { env } from "./env.js";

const logConnectionDetails = (message, uri) => {
  const maskedUri = uri?.replace(/:\/\/[^:@/]+:([^@/]+)@/i, "://***:***@");
  console.log(`${message} (${maskedUri || "missing MONGODB_URI"})`);
};

/**
 * Extract the host list from a MongoDB connection string.
 *
 * Parsing the authority explicitly (rather than with one regex over the whole
 * URI) avoids reading the last character of a credential-less host as the
 * hostname, which produced a meaningless "DNS lookup failed" line.
 */
export const getMongoHosts = (uri) => {
  if (!uri) {
    return [];
  }
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/([^/?#]*)/i);
  if (!match) {
    return [];
  }
  const authority = match[1];
  // Credentials may contain "@" and ":"; the host list starts after the last "@".
  const hostList = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  return hostList
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^\[([^\]]+)\](?::\d+)?$/, "$1"))
    .map((entry) => (net.isIPv6(entry) ? entry : entry.split(":")[0]))
    .filter(Boolean);
};

const validateDns = async (uri) => {
  const hosts = getMongoHosts(uri).filter((host) => !net.isIP(host));
  // IP literals (local/in-memory MongoDB) need no DNS lookup and would only
  // produce a misleading "DNS lookup failed" line.
  if (!hosts.length) {
    return;
  }

  if (/^mongodb\+srv:\/\//i.test(uri)) {
    // +srv has exactly one DNS name; the driver expands the SRV records.
    try {
      await dns.resolveSrv(`_mongodb._tcp.${hosts[0]}`);
      console.log(`MongoDB SRV record resolved (${hosts[0]})`);
    } catch (error) {
      console.error(`MongoDB SRV lookup failed for ${hosts[0]}:`, error.message);
    }
    return;
  }

  const results = await Promise.allSettled(hosts.map((host) => dns.resolve(host)));
  const failed = results
    .map((result, index) => ({ result, host: hosts[index] }))
    .filter(({ result }) => result.status === "rejected");

  if (failed.length) {
    for (const { result, host } of failed) {
      console.error(`MongoDB host DNS lookup failed for ${host}:`, result.reason?.message || result.reason);
    }
    return;
  }
  console.log(`MongoDB host${hosts.length > 1 ? `s (${hosts.join(", ")})` : ` (${hosts[0]})`} resolved`);
};

const buildConnectionOptions = () => ({
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 20000,
  maxPoolSize: 10,
  retryWrites: true
});

const connectWithRetry = async (uri, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      logConnectionDetails(`MongoDB connection attempt ${attempt}/${maxRetries}`, uri);
      await mongoose.connect(uri, buildConnectionOptions());
      return;
    } catch (error) {
      console.error(`MongoDB attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else {
        throw error;
      }
    }
  }
};

export const connectDB = async () => {
  mongoose.connection.on("connected", () => {
    const dbName = mongoose.connection?.db?.databaseName || "unknown";
    console.log(`MongoDB connected (db=${dbName})`);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
  });

  const primaryUri = env.mongodbUri;
  await validateDns(primaryUri);

  try {
    await connectWithRetry(primaryUri, 3);
  } catch (error) {
    if (primaryUri?.startsWith("mongodb+srv://") && env.mongodbUriStandard) {
      console.warn("SRV connection failed. Falling back to standard MongoDB URI.");
      await validateDns(env.mongodbUriStandard);
      await connectWithRetry(env.mongodbUriStandard, 2);
      return;
    }
    if (/ENOTFOUND|EAI_AGAIN/i.test(error.message)) {
      console.error(
        "MongoDB host could not be resolved. The cluster hostname in MONGODB_URI is stale or the cluster was deleted; create a new Atlas cluster and update MONGODB_URI."
      );
    }
    console.error("MongoDB initial connection failed:", error.message);
    throw error;
  }
};
