// src/utils/firebaseAdmin.js
const admin = require('firebase-admin');

// Ensure firebase-admin is initialized only once
if (!admin.apps.length) {
  admin.initializeApp({
    // Using application default credentials or simply providing the projectId
    // If running in AWS Lambda, you typically need service account creds for full access,
    // but for verifyIdToken, just the projectId is usually sufficient.
    projectId: process.env.FIREBASE_PROJECT_ID || 'sib-ceb2d'
  });
}

module.exports = admin;
