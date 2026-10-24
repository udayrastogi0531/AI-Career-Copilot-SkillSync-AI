import mongoose from "mongoose";

const knowledgeChunkSchema = new mongoose.Schema(
  {
    // null userId means the curated, shared knowledge base.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    documentId: { type: String, required: true, index: true },
    sourceId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "career" },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    embedded: { type: Boolean, default: false },
    embeddingModel: { type: String, default: "" },
    knowledgeVersion: { type: String, default: "" }
  },
  { timestamps: true }
);

knowledgeChunkSchema.index({ userId: 1, documentId: 1 });
knowledgeChunkSchema.index({ userId: 1, knowledgeVersion: 1 });

export const KnowledgeChunk = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
