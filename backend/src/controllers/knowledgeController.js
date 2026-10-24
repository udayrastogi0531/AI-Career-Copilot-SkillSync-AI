import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteUserDocument,
  ingestUserDocument,
  listUserDocuments,
  syncCuratedKnowledge
} from "../services/knowledgeService.js";

export const listDocumentsController = asyncHandler(async (req, res) => {
  const documents = await listUserDocuments(req.user.id);
  res.json({ success: true, documents });
});

export const ingestDocumentController = asyncHandler(async (req, res) => {
  const { title, text, url } = req.body || {};
  if (!title || !text) {
    res.status(400);
    throw new Error("title and text are required");
  }

  const document = await ingestUserDocument(req.user.id, { title, text, url });
  res.status(201).json({ success: true, document });
});

export const deleteDocumentController = asyncHandler(async (req, res) => {
  await deleteUserDocument(req.user.id, req.params.documentId);
  res.json({ success: true, message: "Document deleted" });
});

export const syncCuratedController = asyncHandler(async (req, res) => {
  const result = await syncCuratedKnowledge();
  res.json({ success: true, result });
});
