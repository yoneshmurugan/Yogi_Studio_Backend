const { PutCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../utils/db");
const crypto = require("crypto");

/**
 * 1. Get All Portfolio Items (Public)
 * Path: GET /api/v1/public/portfolio
 */
exports.getPortfolio = async (queryStringParameters, sendResponse) => {
  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": "TYPE#PORTFOLIO",
        ":skPrefix": "ITEM#"
      }
    });

    const response = await docClient.send(command);
    
    // Sort items by createdAt descending (newest first)
    const items = (response.Items || []).sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return sendResponse(200, { items });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return sendResponse(500, { error: "Failed to fetch portfolio items" });
  }
};

/**
 * 2. Create Portfolio Item (Admin)
 * Path: POST /api/v1/admin/portfolio
 */
exports.createPortfolioItem = async (body, sendResponse) => {
  try {
    const { category, eventName, title, url, coverUrl, photos, musicUrl } = body;

    if (!category) {
      return sendResponse(400, { error: "Category is required" });
    }

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const newItem = {
      PK: "TYPE#PORTFOLIO",
      SK: `ITEM#${id}`,
      id,
      category,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    if (eventName) newItem.eventName = eventName;
    if (title) newItem.title = title;
    if (url) newItem.url = url;
    if (coverUrl) newItem.coverUrl = coverUrl;
    if (photos && photos.length > 0) newItem.photos = photos;
    if (musicUrl) newItem.musicUrl = musicUrl;

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: newItem
    });

    await docClient.send(command);

    return sendResponse(201, {
      message: "Portfolio item created successfully",
      item: newItem
    });
  } catch (error) {
    console.error("Error creating portfolio item:", error);
    return sendResponse(500, { error: "Failed to create portfolio item" });
  }
};

/**
 * 3. Delete Portfolio Item (Admin)
 * Path: DELETE /api/v1/admin/portfolio/:id
 */
exports.deletePortfolioItem = async (id, sendResponse) => {
  try {
    if (!id) {
      return sendResponse(400, { error: "Item ID is required" });
    }

    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: "TYPE#PORTFOLIO",
        SK: `ITEM#${id}`
      }
    });

    await docClient.send(command);

    return sendResponse(200, { message: "Portfolio item deleted successfully" });
  } catch (error) {
    console.error("Error deleting portfolio item:", error);
    return sendResponse(500, { error: "Failed to delete portfolio item" });
  }
};
