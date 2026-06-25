// src/utils/firebaseAdmin.js
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Ensure firebase-admin is initialized only once
if (!getApps().length) {
  initializeApp({
    // Using application default credentials or simply providing the projectId
    // If running in AWS Lambda, you typically need service account creds for full access,
    // but for verifyIdToken, just the projectId is usually sufficient.
    projectId: process.env.FIREBASE_PROJECT_ID || 'sib-ceb2d'
  });
}

// Export a wrapper that mimics the old `admin.auth()` behavior for compatibility
module.exports = {
  auth: () => getAuth()
};
