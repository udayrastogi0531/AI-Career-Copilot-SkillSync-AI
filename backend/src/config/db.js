import dns from "node:dns/promises";
import mongoose from "mongoose";
import { env } from "./env.js";

const logConnectionDetails = (message, uri) => {
  const maskedUri = uri?.replace(/:\/\/[^:@/]+:([^@/]+)@/i, "://***:***@");
  console.log(`${message} (${maskedUri || "missing MONGODB_URI"})`);
};

const getMongoHost = (uri) => {
  if (!uri) {
    return "";
  }
  const srvMatch = uri.match(/mongodb\+srv:\/\/[^@]+@([^/]+)/i);
  if (srvMatch) {
    return srvMatch[1].split(":")[0];
  }
  const standardMatch = uri.match(/mongodb:\/\/[^@]+@?([^/]+)/i);
  if (standardMatch) {
    return standardMatch[1].split(",")[0].split(":")[0];
  }
  return "";
};

const validateDns = async (uri) => {
  const host = getMongoHost(uri);
  if (!host) {
    return;
  }

  if (uri.startsWith("mongodb+srv://")) {
    try {
      await dns.resolveSrv(`_mongodb._tcp.${host}`);
      console.log("MongoDB SRV record resolved");
    } catch (error) {
      console.error("MongoDB SRV lookup failed:", error.message);
    }
    return;
  }

  try {
    await dns.resolve(host);
    console.log("MongoDB host resolved");
  } catch (error) {
    console.error("MongoDB host DNS lookup failed:", error.message);
  }
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
    console.error("MongoDB initial connection failed:", error.message);
    throw error;
  }
};
