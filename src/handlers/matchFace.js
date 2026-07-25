'use strict';

// Helper: Calculate Cosine Similarity between two 1024-d vectors
// @vladmandic/human embeddings are best matched using cosine similarity.
// Returns a value between -1.0 and 1.0 (higher is more similar).
function cosineSimilarity(arr1, arr2, normA) {
  if (arr1.length !== arr2.length) return 0;
  let dotProduct = 0;
  let normB = 0;
  for (let i = 0; i < arr1.length; i++) {
    dotProduct += arr1[i] * arr2[i];
    normB += arr2[i] * arr2[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { eventId, selfieVector, indexUrl } = body;

    if (!eventId || !selfieVector || !Array.isArray(selfieVector) || !indexUrl) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'Missing eventId, indexUrl, or invalid selfieVector' }),
      };
    }

    let indexData;
    try {
      // Using native fetch available in Node 18+ to fetch the securely signed Firebase URL
      const response = await fetch(indexUrl);
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
    const THRESHOLD = 0.60; // Cosine similarity threshold. Balanced for true positives (0.65 was too strict for some angles)

    // 2. Perform the incredibly fast mathematical search
    // Pre-calculate the magnitude (norm) of the selfieVector once to save millions of multiplications
    let selfieNorm = 0;
    for (let i = 0; i < selfieVector.length; i++) {
      selfieNorm += selfieVector[i] * selfieVector[i];
    }

    for (const photo of photos) {
      const { photoUrl, faceEmbeddings } = photo;
      
      let isMatch = false;
      for (const face of faceEmbeddings) {
        const similarity = cosineSimilarity(selfieVector, face, selfieNorm);
        if (similarity > THRESHOLD) {
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
