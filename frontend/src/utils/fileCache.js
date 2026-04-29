// Lightweight wrapper around IndexedDB using idb-keyval

import { get, set, del, keys, clear } from "idb-keyval";

// ✅ IndexedDB storage quota: 50MB per file, max 10 files
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_CACHED_FILES = 10;

/* ================= GET FILE ================= */
export const getCachedFile = async (key) => {
  try {
    if (!key) {
      console.warn("❌ [IndexedDB] GET: Key is empty");
      return null;
    }

    const data = await get(key);
    if (!data) {
      console.log("❌ [IndexedDB] Cache MISS:", key);
      return null;
    }

    // ✅ Verify it's actually a Blob
    if (!(data instanceof Blob)) {
      console.warn("⚠️ [IndexedDB] Invalid data type (not a Blob):", typeof data);
      return null;
    }

    console.log("⚡ [IndexedDB] Cache HIT:", key, `(${(data.size / 1024 / 1024).toFixed(2)}MB)`);
    return data;
  } catch (err) {
    console.error("❌ [IndexedDB] GET error:", err);
    return null;
  }
};

/* ================= SAVE FILE ================= */
export const setCachedFile = async (key, blob) => {
  try {
    if (!key || !blob) {
      console.warn("❌ [IndexedDB] SET: Key or blob is missing");
      return;
    }

    // ✅ Verify it's a Blob
    if (!(blob instanceof Blob)) {
      console.error("❌ [IndexedDB] Invalid blob type:", typeof blob);
      return;
    }

    // ✅ Check file size
    if (blob.size > MAX_FILE_SIZE) {
      console.error(`❌ [IndexedDB] File too large: ${(blob.size / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      return;
    }

    // ✅ Check number of cached files
    const allKeys = await keys();
    if (allKeys.length >= MAX_CACHED_FILES) {
      console.warn(`⚠️ [IndexedDB] Cache is full (${MAX_CACHED_FILES} files), removing oldest...`);
      // Remove the first (oldest) key
      await del(allKeys[0]);
    }

    await set(key, blob);
    console.log(`✅ [IndexedDB] Saved: ${key} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
  } catch (err) {
    console.error("❌ [IndexedDB] SET error:", err);
    throw err; // ✅ Re-throw so caller can handle
  }
};

/* ================= DELETE FILE ================= */
export const deleteCachedFile = async (key) => {
  try {
    await del(key);
    console.log("🗑️ [IndexedDB] Deleted:", key);
  } catch (err) {
    console.error("❌ [IndexedDB] DELETE error:", err);
  }
};

/* ================= GET ALL KEYS ================= */
export const getAllCacheKeys = async () => {
  try {
    const allKeys = await keys();
    console.log("📦 [IndexedDB] Keys:", allKeys);
    return allKeys;
  } catch (err) {
    console.error("❌ [IndexedDB] KEYS error:", err);
    return [];
  }
};

/* ================= CLEAR CACHE ================= */
export const clearFileCache = async () => {
  try {
    await clear();
    console.log("🔥 [IndexedDB] Cache cleared");
  } catch (err) {
    console.error("❌ [IndexedDB] CLEAR error:", err);
  }
};

/* ================= GET CACHE STATS ================= */
export const getCacheStats = async () => {
  try {
    const allKeys = await keys();
    let totalSize = 0;

    for (const key of allKeys) {
      const blob = await get(key);
      if (blob instanceof Blob) {
        totalSize += blob.size;
      }
    }

    console.log(`📊 [IndexedDB] Stats - Files: ${allKeys.length}, Total Size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    return { fileCount: allKeys.length, totalSize };
  } catch (err) {
    console.error("❌ [IndexedDB] STATS error:", err);
    return { fileCount: 0, totalSize: 0 };
  }
};