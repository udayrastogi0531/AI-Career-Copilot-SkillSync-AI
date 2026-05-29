import mongoose from "mongoose";
import { User } from "./src/models/User.js";
import { env } from "./src/config/env.js";

const clearDatabase = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(env.mongodbUri);
    console.log("✅ Connected to MongoDB Atlas");

    console.log("🧹 Clearing Users collection...");
    const result = await User.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} users`);

    console.log("🔄 Clearing Resumes, Analyses, and InterviewSessions...");
    const db = mongoose.connection.db;
    
    const resumesResult = await db.collection("resumes").deleteMany({});
    console.log(`✅ Deleted ${resumesResult.deletedCount} resumes`);

    const analysisResult = await db.collection("analyses").deleteMany({});
    console.log(`✅ Deleted ${analysisResult.deletedCount} analyses`);

    const interviewResult = await db.collection("interviewsessions").deleteMany({});
    console.log(`✅ Deleted ${interviewResult.deletedCount} interview sessions`);

    console.log("\n✨ Database cleared successfully!");
    console.log("Now you can signup with any email.\n");

    await mongoose.connection.close();
    console.log("✅ Connection closed");
  } catch (error) {
    console.error("❌ Error clearing database:", error.message);
    process.exit(1);
  }
};

clearDatabase();
