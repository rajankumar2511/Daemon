import multer from "multer";

/* ───────── STORAGE (MEMORY - NO DISK) ───────── */
const storage = multer.memoryStorage();

/* ───────── FILE FILTER ───────── */
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Videos
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    // Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    // Archive
    "application/zip",
    "application/x-rar-compressed",
    // Text
    "text/plain",
    "application/json",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    console.log("✅ File accepted:", {
      filename: file.originalname,
      mimetype: file.mimetype,
    });
    cb(null, true);
  } else {
    console.warn("❌ File rejected:", {
      filename: file.originalname,
      mimetype: file.mimetype,
    });

    cb(
      new Error(
        `File type '${file.mimetype}' not allowed`
      ),
      false
    );
  }
};

/* ───────── ERROR HANDLER ───────── */
const errorHandler = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File too large (max 50MB)",
        code: "FILE_TOO_LARGE",
      });
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "Too many files",
        code: "FILE_TOO_MANY",
      });
    }

    return res.status(400).json({
      message: error.message,
      code: error.code,
    });
  }

  if (error) {
    return res.status(400).json({
      message: error.message || "Upload failed",
      code: "UPLOAD_ERROR",
    });
  }

  next();
};

/* ───────── MULTER INSTANCE ───────── */
export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter,
});

/* ───────── MIDDLEWARE WRAPPER ───────── */
export const uploadSingleFile = (fieldName = "file") => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        return errorHandler(err, req, res, next);
      }

      // ❗ Extra safety
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
          code: "NO_FILE",
        });
      }

      next();
    });
  };
};
