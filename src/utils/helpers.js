// src/utils/helpers.js

/**
 * Strips all spaces, dashes, and non-digit characters from a phone number,
 * keeping only the leading '+' sign if present.
 * Example: "+91 98765 43210" -> "+919876543210"
 */
exports.sanitizePhone = (phone) => {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, '');
};

const zlib = require('zlib');

exports.compressFolders = (foldersArray) => {
  if (!foldersArray || !Array.isArray(foldersArray)) return foldersArray;
  const jsonStr = JSON.stringify(foldersArray);
  if (jsonStr.length < 50000) {
    return foldersArray;
  }
  return 'GZIP:' + zlib.gzipSync(jsonStr).toString('base64');
};

exports.decompressFolders = (foldersData) => {
  if (typeof foldersData === 'string' && foldersData.startsWith('GZIP:')) {
    try {
      const base64Data = foldersData.substring(5);
      const decompressed = zlib.unzipSync(Buffer.from(base64Data, 'base64')).toString('utf-8');
      return JSON.parse(decompressed);
    } catch(err) {
      console.error("Error decompressing folders:", err);
      return [];
    }
  }
  return foldersData || [];
};
