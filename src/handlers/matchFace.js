'use strict';

// Helper: Calculate Euclidean Distance between two 128-d vectors
// face-api.js natively uses Euclidean distance. A distance < 0.6 is a match.
function euclideanDistance(arr1, arr2) {
  if (arr1.length !== arr2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { eventId, selfieVector } = body;

    if (!eventId || !selfieVector || !Array.isArray(selfieVector)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'Missing eventId or invalid selfieVector' }),
      };
    }

    // 1. Fetch the face_index.json directly from Firebase Storage REST API
    // Assuming standard bucket format and public read access for the event photos
    const bucketName = 'sib-ceb2d.appspot.com';
    const filePath = encodeURIComponent(`events/${eventId}/face_index.json`);
    const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${filePath}?alt=media`;

    let indexData;
    try {
      // Using native fetch available in Node 18+
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch index: ${response.statusText}`);
      }
      indexData = await response.json();
    } catch (err) {
      console.error('Error fetching face index:', err);
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Could not find face index for this event. Ensure Admin has processed the photos.' }),
      };
    }

    const { photos } = indexData;
    const matchedPhotos = [];
    const THRESHOLD = 0.6; // Industry standard strictness for face-api.js

    // 2. Perform the incredibly fast mathematical search
    for (const photo of photos) {
      const { photoUrl, faceEmbeddings } = photo;
      
      let isMatch = false;
      for (const face of faceEmbeddings) {
        const distance = euclideanDistance(selfieVector, face);
        if (distance < THRESHOLD) {
          isMatch = true;
          break; // Stop checking other faces in this photo, it's already a match
        }
      }

      if (isMatch) {
        matchedPhotos.push(photoUrl);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Search complete',
        matchesFound: matchedPhotos.length,
        photos: matchedPhotos,
      }),
    };

  } catch (error) {
    console.error('matchFace Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};
