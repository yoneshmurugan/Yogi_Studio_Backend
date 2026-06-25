// src/routes/customer.js
const { QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../utils/db");
const { sanitizePhone } = require("../utils/helpers");
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

  const cleanPhone = sanitizePhone(phone);

  // Check if this phone number exists in our DynamoDB table
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `PHONE#${cleanPhone}` }
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
    user: { phone: cleanPhone } 
  });
};

/**
 * 1.5 Pre-check Phone (Customer Login)
 * Path: POST /api/v1/customer/auth/check-phone
 * Checks if a phone number exists in the database BEFORE sending OTP to save SMS costs.
 */
exports.checkPhone = async (body, sendResponse) => {
  const { phone } = body;
  if (!phone) return sendResponse(400, { error: "Phone number is required" });

  const cleanPhone = sanitizePhone(phone);

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `PHONE#${cleanPhone}` },
    Limit: 1
  });

  const response = await docClient.send(command);

  if (!response.Items || response.Items.length === 0) {
    return sendResponse(404, { error: "Phone number not registered" });
  }

  return sendResponse(200, { message: "Phone number valid" });
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

  // Fetch everything tied to this phone number (Profile + Events) in a single query
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { 
      ":pk": `PHONE#${decoded.phone}`
    }
  });

  const response = await docClient.send(command);

  if (!response.Items || response.Items.length === 0) {
    return sendResponse(404, { error: "No data found." });
  }

  // Extract the profile and the events
  const profileItem = response.Items.find(item => item.SK.startsWith("PROFILE#"));
  const events = response.Items.filter(item => item.SK.startsWith("EVENT#"));

  if (events.length === 0) {
    return sendResponse(404, { error: "No active events found." });
  }

  // Retroactively backfill the user's name onto old events that didn't have it saved
  const customerName = profileItem ? profileItem.name : "Your Gallery";
  const updatedEvents = events.map(ev => ({
    ...ev,
    customerName: ev.customerName || customerName
  }));

  // Return all events
  return sendResponse(200, { events: updatedEvents });
};

/**
 * 3. Submit Photo Selections
 * Path: POST /api/v1/customer/events/:eventId/submit-selections
 */
exports.submitSelections = async (eventId, body, headers, sendResponse) => {
  const decoded = verifyToken(headers);
  if (!decoded) return sendResponse(401, { error: "Unauthorized or expired token" });

  const { selectedPhotoIds, photoComments } = body; // selectedPhotoIds: ['id1', 'id2'], photoComments: { 'id1': 'comment' }

  if (!selectedPhotoIds || !Array.isArray(selectedPhotoIds)) {
    return sendResponse(400, { error: "Invalid selection payload" });
  }

  // We can directly fetch the event because we know the phone number (PK) from the JWT
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `PHONE#${decoded.phone}`,
      ":sk": `EVENT#${eventId}`
    }
  });

  const eventData = await docClient.send(command);

  if (!eventData.Items || eventData.Items.length === 0) {
    return sendResponse(404, { error: "Event not found or you don't have access" });
  }

  const event = eventData.Items[0];

  // Map through the folders and photos to flip the `is_selected` boolean
  const updatedFolders = (event.folders || []).map(folder => ({
    ...folder,
    photos: (folder.photos || []).map(photo => ({
      ...photo,
      is_selected: selectedPhotoIds.includes(photo.id),
      comment: photoComments && photoComments[photo.id] !== undefined ? photoComments[photo.id] : (photo.comment || "")
    }))
  }));

  // Save the updated array back to DynamoDB and change the status to 'awaiting_approval'
  const updateCommand = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { 
      PK: event.PK, 
      SK: event.SK 
    },
    UpdateExpression: "SET folders = :folders, #st = :status",
    ExpressionAttributeNames: { "#st": "status" },
    ExpressionAttributeValues: {
      ":folders": updatedFolders,
      ":status": "awaiting_approval"
    }
  });

  await docClient.send(updateCommand);

  return sendResponse(200, { 
    message: "Selections successfully submitted!",
    status: "awaiting_approval"
  });
};

/**
 * 4. Revert Photo Selections (Edit Response)
 * Path: POST /api/v1/customer/events/:eventId/revert-selections
 */
exports.revertSelections = async (eventId, headers, sendResponse) => {
  const decoded = verifyToken(headers);
  if (!decoded) return sendResponse(401, { error: "Unauthorized or expired token" });

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `PHONE#${decoded.phone}`,
      ":sk": `EVENT#${eventId}`
    }
  });

  const eventData = await docClient.send(command);

  if (!eventData.Items || eventData.Items.length === 0) {
    return sendResponse(404, { error: "Event not found or you don't have access" });
  }

  const event = eventData.Items[0];

  const updateCommand = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { 
      PK: event.PK, 
      SK: event.SK 
    },
    UpdateExpression: "SET #st = :status",
    ExpressionAttributeNames: { "#st": "status" },
    ExpressionAttributeValues: {
      ":status": "selection_in_progress"
    }
  });

  await docClient.send(updateCommand);

  return sendResponse(200, { 
    message: "Selections reverted, you can now edit.",
    status: "selection_in_progress"
  });
};

/**
 * 5. Save Partial Selections (Cross-device sync)
 * Path: PATCH /api/v1/customer/events/:eventId/progress
 */
exports.saveProgress = async (eventId, body, headers, sendResponse) => {
  const decoded = verifyToken(headers);
  if (!decoded) return sendResponse(401, { error: "Unauthorized or expired token" });

  const { selectedPhotoIds = [], rejectedPhotoIds = [], photoComments = {} } = body;

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      "PK": `PHONE#${decoded.phone}`,
      "SK": `EVENT#${eventId}`
    },
    UpdateExpression: "SET selectedPhotoIds = :sel, rejectedPhotoIds = :rej, photoComments = :com",
    ExpressionAttributeValues: {
      ":sel": selectedPhotoIds,
      ":rej": rejectedPhotoIds,
      ":com": photoComments
    },
    ConditionExpression: "attribute_exists(PK)" // Ensure the event actually exists
  });

  try {
    await docClient.send(command);
    return sendResponse(200, { message: "Progress saved successfully" });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return sendResponse(404, { error: "Event not found" });
    }
    console.error("Error saving progress:", err);
    return sendResponse(500, { error: "Failed to save progress" });
  }
};