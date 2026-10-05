import mongoose from 'mongoose';

/** Cloudinary asset metadata stored inline on a document. */
export const fileMetaSchema = new mongoose.Schema(
  {
    publicId: { type: String, default: '' },
    url: { type: String, default: '' },
    resourceType: { type: String, default: 'image' },
    bytes: { type: Number, default: 0 },
    format: { type: String, default: '' },
    access: { type: String, default: 'public' },
  },
  { _id: false }
);
