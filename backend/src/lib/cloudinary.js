import dotenv from "dotenv";
dotenv.config();

import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

console.log("🔥 CLOUDINARY ENV CHECK:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "✅ FOUND" : "❌ MISSING",
  api_key: process.env.CLOUDINARY_API_KEY ? "✅ FOUND" : "❌ MISSING",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ FOUND" : "❌ MISSING",
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      if (!fileBuffer) {
        console.error("❌ No file buffer provided");
        return reject(new Error("No file buffer provided"));
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "whatsapp_messages",
          timeout: 120000,
          ...options,
        },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary upload error:", error.message);
            return reject(error);
          }

          console.log("✅ Uploaded to Cloudinary:", {
            url: result.secure_url,
            publicId: result.public_id,
            size: result.bytes,
            format: result.format
          });
          resolve(result);
        }
      );

      streamifier.createReadStream(fileBuffer).pipe(uploadStream);

    } catch (err) {
      console.error("❌ Unexpected Cloudinary error:", err.message);
      reject(err);
    }
  });
};
