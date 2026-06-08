// src/routes/customer.js
const { QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../utils/db");
const jwt = require("jsonwebtoken");

// In production, this should be set securely in your AWS environment variables
const JWT_SECRET = process.env.JWT_SECRET || "yogi-studio-super-secret-key";

/**
 * 1. Verify OTP & Create Session
 * Path: POST /api/v1/customer/auth/verify-otp
 */
exports.verifyCustomerOtp = async (body, sendResponse) => {
  const { phone } = body;

  if (!phone) {
    return sendResponse(400, { error: "Phone number is required" });
  }

  // Check if this phone number exists in our DynamoDB table
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `PHONE#${phone}` }
  });

  const response = await docClient.send(command);

  if (!response.Items || response.Items.length === 0) {
    return sendResponse(404, { error: "No events found for this phone number." });
  }

  // Generate a secure session token valid for 24 hours
  const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: "24h" });

  return sendResponse(200, { 
    message: "Login successful", 
    token,
    user: { phone } 
  });
};

/**
 * Helper function to extract and verify the JWT from headers
 */
const verifyToken = (headers) => {
  const authHeader = headers.Authorization || headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  
  const token = authHeader.split(" ")[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

/**
 * 2. Fetch Active Event Data
 * Path: GET /api/v1/customer/events/current
 */
exports.getCurrentEvent = async (headers, sendResponse) => {
  const decoded = verifyToken(headers);
  if (!decoded) return sendResponse(401, { error: "Unauthorized or expired token" });

  // Fetch all events tied to this phone number
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: { 
      ":pk": `PHONE#${decoded.phone}`,
      ":skPrefix": "EVENT#"
    }
  });

  const response = await docClient.send(command);

  if (!response.Items || response.Items.length === 0) {
    return sendResponse(404, { error: "No active events found." });
  }

  // For simplicity, return the most recent event (or you could return an array of all their events)
  const currentEvent = response.Items[response.Items.length - 1];

  return sendResponse(200, { event: currentEvent });
};

/**
 * 3. Submit Photo Selections
 * Path: POST /api/v1/customer/events/:eventId/submit-selections
 */
exports.submitSelections = async (eventId, body, sendResponse) => {
  const { selectedPhotoIds } = body; // Array of IDs: ['uuid1', 'uuid2']

  if (!selectedPhotoIds || !Array.isArray(selectedPhotoIds)) {
    return sendResponse(400, { error: "Invalid selection payload" });
  }

  // To update safely, we first fetch the event to get the phone number (PK) and existing photos
  // Note: In a highly optimized setup, you might pass the PK in the token or URL
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI1", // Using the GSI to find the event by its ID if we don't know the exact phone number
    KeyConditionExpression: "GSI1_PK = :gsiPk AND GSI1_SK = :gsiSk",
    ExpressionAttributeValues: {
      ":gsiPk": `EVENT#${eventId}`,
      ":gsiSk": `EVENT#${eventId}`
    }
  });

  const eventData = await docClient.send(command);

  if (!eventData.Items || eventData.Items.length === 0) {
    return sendResponse(404, { error: "Event not found" });
  }

  const event = eventData.Items[0];

  // Map through the photos array and flip the `is_selected` boolean
  const updatedPhotos = event.photos.map(photo => ({
    ...photo,
    is_selected: selectedPhotoIds.includes(photo.id)
  }));

  // Save the updated array back to DynamoDB and change the status to 'awaiting_approval'
  const updateCommand = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { 
      PK: event.PK, 
      SK: event.SK 
    },
    UpdateExpression: "SET photos = :photos, #st = :status",
    ExpressionAttributeNames: { "#st": "status" },
    ExpressionAttributeValues: {
      ":photos": updatedPhotos,
      ":status": "awaiting_approval"
    }
  });

  await docClient.send(updateCommand);

  return sendResponse(200, { 
    message: "Selections successfully submitted!",
    status: "awaiting_approval"
  });
};