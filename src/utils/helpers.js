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
