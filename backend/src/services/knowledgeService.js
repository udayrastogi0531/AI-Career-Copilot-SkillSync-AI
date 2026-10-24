import crypto from "node:crypto";
import mongoose from "mongoose";
import { KnowledgeChunk } from "../models/KnowledgeChunk.js";
import { CAREER_KNOWLEDGE, KNOWLEDGE_VERSION } from "../data/careerKnowledge.js";
import { embedText, embeddingModelId } from "./aiService.js";

const serviceError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const STOPWORDS = new Set(
  `the a an and or of to in for on with is are was were be been being this that these those you your my our it its as at by from into not no if then than so such can could should would about how what when where who why do does did done have has had will just more most much many very`.split(
    /\s+/
  )
);

export const chunkText = (text, { maxChars = 900, overlap = 150 } = {}) => {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if ((current + "\n" + paragraph).length <= maxChars) {
      current = current ? `${current}\n${paragraph}` : paragraph;
      continue;
    }
    flush();
    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }
    // Very long paragraph: split on sentence boundaries.
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if ((current + " " + sentence).length > maxChars) {
        const carry = current.slice(-overlap);
        flush();
        current = carry ? `${carry} ${sentence}` : sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
  }
  flush();

  return chunks;
};

const makeDocumentId = (prefix, value) =>
  `${prefix}:${crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 20)}`;

const storeChunks = async ({ userId, documentId, sourceId, title, url, category, chunks }) => {
  const rows = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const content = chunks[index];
    let embedding = [];
    let embedded = false;
    try {
      embedding = await embedText(`${title}\n${content}`);
      embedded = true;
    } catch (error) {
      console.warn("[KNOWLEDGE] Embedding unavailable; storing chunk for lexical retrieval.", error.code || error.message);
    }
    rows.push({
      userId,
      documentId,
      sourceId,
      title,
      url,
      category,
      chunkIndex: index,
      content,
      embedding,
      embedded,
      embeddingModel: embedded ? embeddingModelId : "",
      knowledgeVersion: userId ? "" : KNOWLEDGE_VERSION
    });
  }

  if (rows.length) await KnowledgeChunk.insertMany(rows);
  return rows.length;
};

export const syncCuratedKnowledge = async () => {
  const existing = await KnowledgeChunk.countDocuments({ userId: null, knowledgeVersion: KNOWLEDGE_VERSION });
  if (existing > 0) {
    return { synced: false, documents: 0, chunks: existing, version: KNOWLEDGE_VERSION };
  }

  await KnowledgeChunk.deleteMany({ userId: null });

  let totalChunks = 0;
  for (const document of CAREER_KNOWLEDGE) {
    const chunks = chunkText(document.content);
    totalChunks += await storeChunks({
      userId: null,
      documentId: makeDocumentId("curated", document.id),
      sourceId: document.id,
      title: document.title,
      url: document.url,
      category: "curated",
      chunks
    });
  }

  return {
    synced: true,
    documents: CAREER_KNOWLEDGE.length,
    chunks: totalChunks,
    version: KNOWLEDGE_VERSION,
    embedded: await KnowledgeChunk.countDocuments({ userId: null, embedded: true })
  };
};

export const ingestUserDocument = async (userId, { title, text, url = "" }) => {
  const name = String(title || "").trim().slice(0, 200);
  const content = String(text || "").trim();
  if (!name) throw serviceError("Document title is required.");
  if (content.length < 200) throw serviceError("Document text is too short to be useful.");
  if (content.length > 200000) throw serviceError("Document is too large. Limit it to 200,000 characters.");

  const documentId = makeDocumentId(`user:${userId}`, `${name}:${content.length}`);
  await KnowledgeChunk.deleteMany({ userId, documentId });

  const chunks = chunkText(content);
  const stored = await storeChunks({
    userId,
    documentId,
    sourceId: name,
    title: name,
    url: String(url || "").slice(0, 500),
    category: "user-document",
    chunks
  });

  return { documentId, title: name, chunks: stored };
};

export const listUserDocuments = async (userId) => {
  const rows = await KnowledgeChunk.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: "$documentId",
        title: { $first: "$title" },
        url: { $first: "$url" },
        chunks: { $sum: 1 },
        embedded: { $sum: { $cond: ["$embedded", 1, 0] } },
        updatedAt: { $max: "$updatedAt" }
      }
    },
    { $sort: { updatedAt: -1 } }
  ]);

  return rows.map((row) => ({
    documentId: row._id,
    title: row.title,
    url: row.url,
    chunks: row.chunks,
    embedded: row.embedded,
    updatedAt: row.updatedAt
  }));
};

export const deleteUserDocument = async (userId, documentId) => {
  const result = await KnowledgeChunk.deleteMany({ userId, documentId });
  if (!result.deletedCount) throw serviceError("Document not found", 404);
  return { deleted: result.deletedCount };
};

const cosineSimilarity = (a = [], b = []) => {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const lexicalScore = (queryTokens, content) => {
  const contentTokens = new Set(tokenize(content));
  if (!queryTokens.length || !contentTokens.size) return 0;
  const overlap = queryTokens.filter((token) => contentTokens.has(token)).length;
  return overlap / queryTokens.length;
};

/**
 * Retrieve grounding sources for a question.
 *
 * Isolation: the query can only ever match curated chunks (userId null) or the
 * authenticated user's own chunks.
 */
export const retrieveKnowledge = async (userId, query, { topK = 6 } = {}) => {
  const question = String(query || "").trim();
  if (!question) return { sources: [], retrieval: "none" };

  const candidates = await KnowledgeChunk.find({
    $or: [{ userId: null }, { userId }]
  })
    .sort({ updatedAt: -1 })
    .limit(2000)
    .select("documentId title url content embedding embedded category chunkIndex");

  if (!candidates.length) return { sources: [], retrieval: "empty" };

  let queryEmbedding = null;
  try {
    queryEmbedding = await embedText(question);
  } catch (error) {
    console.warn("[KNOWLEDGE] Query embedding unavailable; using lexical retrieval.", error.code || error.message);
  }

  const queryTokens = tokenize(question);
  const vectorReady = Boolean(queryEmbedding) && candidates.some((chunk) => chunk.embedded && chunk.embedding?.length);

  const scored = candidates
    .map((chunk) => {
      const vectorScore =
        vectorReady && chunk.embedded && chunk.embedding?.length
          ? cosineSimilarity(queryEmbedding, chunk.embedding)
          : 0;
      const keywordScore = lexicalScore(queryTokens, `${chunk.title} ${chunk.content}`);
      const score = vectorReady ? vectorScore * 0.75 + keywordScore * 0.25 : keywordScore;
      return { chunk, score, vectorScore, keywordScore };
    })
    .filter((row) => row.score > (vectorReady ? 0.18 : 0.12))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    retrieval: vectorReady ? "vector+lexical" : "lexical",
    embeddingModel: vectorReady ? embeddingModelId : "",
    sources: scored.map((row) => ({
      documentId: row.chunk.documentId,
      title: row.chunk.title,
      url: row.chunk.url || "",
      content: row.chunk.content,
      kind: row.chunk.category === "curated" ? "curated" : "your-document",
      score: Number(row.score.toFixed(4))
    }))
  };
};
