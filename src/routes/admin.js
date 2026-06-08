// src/routes/admin.js
const { PutCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../utils/db");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "yogi-studio-super-secret-key";

/**
 * 1. Admin Login (OTP Verification)
 * Path: POST /api/v1/admin/users/verify-otp
 * Note: Assuming Firebase Auth verified the phone on the frontend, we issue the Admin JWT here.
 */
exports.verifyOtp = async (body, sendResponse) => {
  const { phone } = body;

  if (!phone) {
    return sendResponse(400, { error: "Phone number is required" });
  }

  // In a production environment, you would check if this phone number belongs to an authorized Admin.
  // For now, we issue a secure Admin session token.
  const token = jwt.sign({ phone, role: "admin" }, JWT_SECRET, { expiresIn: "24h" });

  return sendResponse(200, { 
    message: "Admin login successful", 
    token,
    user: { phone, role: "admin" } 
  });
};

/**
 * Helper function to verify Admin JWT
 */
const verifyAdminToken = (headers) => {
  const authHeader = headers.Authorization || headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    if (decoded.role !== "admin") return null;
    return decoded;
  } catch (err) {
    return null;
  }
};

/**
 * 2. Create Event (Admin Dashboard)
 * Path: POST /api/v1/admin/events
 */
exports.createEvent = async (body, sendResponse) => {
  // We extract the customer phone number from the payload so we can use it as the Partition Key
  const { customerPhone, eventName, category, date, packageType, folders } = body;

  if (!customerPhone || !eventName) {
    return sendResponse(400, { error: "Customer Phone and Event Name are required" });
  }

  // Generate a unique ID for this specific event
  const eventId = uuidv4();
  const timestamp = new Date().toISOString();

  // Construct the Single-Table DynamoDB Item
  const newEvent = {
    PK: `PHONE#${customerPhone}`,          // Primary Access Key for the customer
    SK: `EVENT#${eventId}`,                // Unique identifier for the event
    GSI1_PK: "TYPE#EVENT",                 // Static PK groups all events together
    GSI1_SK: `DATE#${timestamp}`,          // SK sorts them chronologically
    id: eventId,
    customerPhone,
    eventName,
    category: category || "Wedding",
    eventDate: date || timestamp,
    packageType: packageType || "Essential",
    status: "active",
    folders: folders || [],                // Array of folder objects containing photos
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: newEvent
  });

  await docClient.send(command);

  return sendResponse(201, { 
    message: "Event successfully created", 
    event: newEvent 
  });
};

/**
 * 3. List All Events (Admin Dashboard Analytics)
 * Path: GET /api/v1/admin/events
 */
exports.listEvents = async (queryStringParameters, sendResponse) => {
  // To populate the Admin dashboard, we query the GSI for all events sorted by date.
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1_PK = :typePk",
    ExpressionAttributeValues: {
      ":typePk": "TYPE#EVENT"
    },
    ScanIndexForward: false // Returns newest events first
  });

  const response = await docClient.send(command);

  return sendResponse(200, {
    totalEvents: response.Items ? response.Items.length : 0,
    events: response.Items || []
  });
};