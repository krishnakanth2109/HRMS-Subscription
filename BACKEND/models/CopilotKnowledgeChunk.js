import mongoose from "mongoose";

const copilotKnowledgeChunkSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      default: "global",
      index: true,
    },
    docId: {
      type: String,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "leave_policy",
        "attendance_policy",
        "overtime_policy",
        "wfh_policy",
        "shift_policy",
        "general_guidelines",
        "payroll_guidelines",
      ],
    },
    content: {
      type: String,
      required: true,
    },
    contentHash: {
      type: String,
      required: true,
    },
    chunkIndex: {
      type: Number,
      default: 0,
    },
    totalChunks: {
      type: Number,
      default: 1,
    },
    version: {
      type: Number,
      default: 1,
    },
    embedding: {
      type: [Number],
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index per tenant/company, document title, and chunkIndex for chunked versioning
copilotKnowledgeChunkSchema.index({ companyId: 1, title: 1, chunkIndex: 1 }, { unique: true });

const CopilotKnowledgeChunk = mongoose.model(
  "CopilotKnowledgeChunk",
  copilotKnowledgeChunkSchema
);

export default CopilotKnowledgeChunk;
