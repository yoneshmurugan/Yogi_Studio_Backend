// src/routes/admin.js
const { PutCommand, QueryCommand, ScanCommand, DeleteCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../utils/db");
const { sanitizePhone, compressFolders, decompressFolders } = require("../utils/helpers");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "yogi-studio-super-secret-key";

/**
 * 2. Create User (Admin Dashboard)
 * Path: POST /api/v1/admin/users
 */
exports.createUser = async (body, sendResponse) => {
  const { name, phone } = body;
  
  if (!name || !phone) {
    return sendResponse(400, { error: "Name and Phone are required" });
  }

  const cleanPhone = sanitizePhone(phone);
  const timestamp = new Date().toISOString();
  // Using the phone number to form the User ID
  const userId = Date.now(); 

  const newUser = {
    PK: `PHONE#${cleanPhone}`,
    SK: `PROFILE#${cleanPhone}`,
    GSI1_PK: "TYPE#USER",
    GSI1_SK: `DATE#${timestamp}`,
    id: userId,
    name,
    phone: cleanPhone,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: newUser
  });

  await docClient.send(command);

  return sendResponse(201, {
    message: "User successfully created",
    user: newUser
  });
};

/**
 * 3. List All Users (Admin Dashboard)
 * Path: GET /api/v1/admin/users
 */
exports.listUsers = async (queryStringParameters, sendResponse) => {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1_PK = :typePk",
    ExpressionAttributeValues: {
      ":typePk": "TYPE#USER"
    },
    ScanIndexForward: false
  });

  const response = await docClient.send(command);

  return sendResponse(200, {
    totalUsers: response.Items ? response.Items.length : 0,
    users: response.Items || []
  });
};

/**
 * 4. Create Event (Admin Dashboard)
 * Path: POST /api/v1/admin/events
 */
exports.createEvent = async (body, sendResponse) => {
  const { customerPhone, customerName, eventName, category, date, packageType, folders } = body;

  if (!customerPhone || !eventName) {
    return sendResponse(400, { error: "Customer Phone and Event Name are required" });
  }

  const cleanPhone = sanitizePhone(customerPhone);

  // Generate a unique ID for this specific event
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Securely generate a 6-character uppercase access token (e.g., 8F9D2A)
  const accessToken = crypto.randomUUID().split('-')[0].toUpperCase().substring(0, 6);

  // Construct the Single-Table DynamoDB Item
  const newEvent = {
    PK: `PHONE#${cleanPhone}`,             // Primary Access Key for the customer
    SK: `EVENT#${eventId}`,                // Unique identifier for the event
    GSI1_PK: "TYPE#EVENT",                 // Static PK groups all events together
    GSI1_SK: `DATE#${timestamp}`,          // SK sorts them chronologically
    id: eventId,
    customerPhone: cleanPhone,
    customerName: customerName || "Your Gallery",
    eventName,
    category: category || "Wedding",
    eventDate: date || timestamp,
    packageType: packageType || "Essential",
    status: "pending",                     // Matches frontend status
    accessToken,                           // Backend-generated access token
    downloadedAt: null,
    folders: compressFolders(folders || []),                // Array of folder objects containing photos
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
 * 5. List All Events (Admin Dashboard Analytics)
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

    const events = (response.Items || []).map(ev => ({
    ...ev,
    folders: ev.folders ? decompressFolders(ev.folders) : []
  }));

  return sendResponse(200, {
    totalEvents: events.length,
    events: events
  });
};

/**
 * 6. Delete User (Admin Dashboard)
 * Path: DELETE /api/v1/admin/users/:phone
 * This cascades and deletes the user profile AND all associated events.
 */
exports.deleteUser = async (phone, sendResponse) => {
  if (!phone) return sendResponse(400, { error: "Phone number is required" });
  const cleanPhone = sanitizePhone(phone);
  
  const queryCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `PHONE#${cleanPhone}` }
  });
  
  const response = await docClient.send(queryCommand);
  
  if (response.Items && response.Items.length > 0) {
    for (const item of response.Items) {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK }
      }));
    }
  }

  return sendResponse(200, { message: "User and all associated events deleted successfully" });
};

/**
 * 7. Delete Event (Admin Dashboard)
 * Path: DELETE /api/v1/admin/events/:eventId?phone=...
 */
exports.deleteEvent = async (eventId, phone, sendResponse) => {
  if (!eventId || !phone) {
    return sendResponse(400, { error: "Event ID and Customer Phone are required" });
  }
  const cleanPhone = sanitizePhone(phone);

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { 
      PK: `PHONE#${cleanPhone}`, 
      SK: `EVENT#${eventId}` 
    }
  }));

  return sendResponse(200, { message: "Event deleted successfully" });
};

/**
 * 8. Update Event (Admin Dashboard)
 * Path: PATCH /api/v1/admin/events/:eventId?phone=...
 * Can update folders, status, downloadedAt.
 */
exports.updateEvent = async (eventId, phone, body, sendResponse) => {
  if (!eventId || !phone) {
    return sendResponse(400, { error: "Event ID and Customer Phone are required" });
  }
  const cleanPhone = sanitizePhone(phone);

  const updates = [];
  const ExpressionAttributeNames = {};
  const ExpressionAttributeValues = {};

  if (body.folders !== undefined) {
    updates.push("#f = :f");
    ExpressionAttributeNames["#f"] = "folders";
    ExpressionAttributeValues[":f"] = compressFolders(body.folders);
  }
  if (body.status !== undefined) {
    updates.push("#s = :s");
    ExpressionAttributeNames["#s"] = "status";
    ExpressionAttributeValues[":s"] = body.status;
  }
  if (body.downloadedAt !== undefined) {
    updates.push("#d = :d");
    ExpressionAttributeNames["#d"] = "downloadedAt";
    ExpressionAttributeValues[":d"] = body.downloadedAt;
  }

  if (updates.length === 0) {
    return sendResponse(400, { error: "No fields to update" });
  }

  // Always update the timestamp
  updates.push("#u = :u");
  ExpressionAttributeNames["#u"] = "updatedAt";
  ExpressionAttributeValues[":u"] = new Date().toISOString();

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { 
      PK: `PHONE#${cleanPhone}`, 
      SK: `EVENT#${eventId}` 
    },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ReturnValues: "ALL_NEW"
  });

  const response = await docClient.send(command);
  return sendResponse(200, { event: response.Attributes });
};