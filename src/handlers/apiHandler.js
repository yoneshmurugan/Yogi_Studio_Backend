// src/handlers/apiHandler.js

// We will build these controller files in Phase 3
const adminRoutes = require('../routes/admin');
const customerRoutes = require('../routes/customer');
const portfolioRoutes = require('../routes/portfolio');

// Standard CORS headers so your React frontend (hosted anywhere) can talk to this API
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // In production, you can restrict this to your actual frontend domain
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PUT, PATCH, DELETE"
};

// Helper function to format responses cleanly
const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  const { httpMethod, path, body, headers, queryStringParameters } = event;

  // 1. Handle CORS Preflight Requests (Browser security check)
  if (httpMethod === "OPTIONS") {
    return sendResponse(200, { message: "CORS OK" });
  }

  // 2. Safely parse the incoming JSON payload (if it exists)
  let parsedBody = null;
  if (body) {
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      return sendResponse(400, { error: "Invalid JSON payload" });
    }
  }

  try {
    // ==========================================
    // 3. THE ROUTING ENGINE
    // ==========================================

    // ---- A. ADMIN ROUTES ----
    if (path.startsWith("/api/v1/admin")) {
      
      // User Management
      if (path === "/api/v1/admin/users" && httpMethod === "POST") {
        return await adminRoutes.createUser(parsedBody, sendResponse);
      }
      if (path === "/api/v1/admin/users" && httpMethod === "GET") {
        return await adminRoutes.listUsers(queryStringParameters, sendResponse);
      }
      const userMatch = path.match(/^\/api\/v1\/admin\/users\/(.+)$/);
      if (userMatch && httpMethod === "DELETE") {
        const phone = decodeURIComponent(userMatch[1]);
        return await adminRoutes.deleteUser(phone, sendResponse);
      }

      // Event Management
      if (path === "/api/v1/admin/events" && httpMethod === "POST") {
        return await adminRoutes.createEvent(parsedBody, sendResponse);
      }
      if (path === "/api/v1/admin/events" && httpMethod === "GET") {
        return await adminRoutes.listEvents(queryStringParameters, sendResponse);
      }
      const eventMatch = path.match(/^\/api\/v1\/admin\/events\/([^\/]+)$/);
      if (eventMatch && httpMethod === "DELETE") {
        const eventId = eventMatch[1];
        const phone = queryStringParameters?.phone;
        return await adminRoutes.deleteEvent(eventId, phone, sendResponse);
      }
      if (eventMatch && httpMethod === "PATCH") {
        const eventId = eventMatch[1];
        const phone = queryStringParameters?.phone;
        return await adminRoutes.updateEvent(eventId, phone, parsedBody, sendResponse);
      }

      // Portfolio Management
      if (path === "/api/v1/admin/portfolio" && httpMethod === "POST") {
        return await portfolioRoutes.createPortfolioItem(parsedBody, sendResponse);
      }
      const portfolioMatch = path.match(/^\/api\/v1\/admin\/portfolio\/([^\/]+)$/);
      if (portfolioMatch && httpMethod === "DELETE") {
        const itemId = portfolioMatch[1];
        return await portfolioRoutes.deletePortfolioItem(itemId, sendResponse);
      }
    }

    // ---- B. PUBLIC ROUTES ----
    if (path.startsWith("/api/v1/public")) {
      if (path === "/api/v1/public/portfolio" && httpMethod === "GET") {
        return await portfolioRoutes.getPortfolio(queryStringParameters, sendResponse);
      }
    }

    // ---- C. CUSTOMER ROUTES ----
    if (path.startsWith("/api/v1/customer")) {
      
      // Customer Auth (Validating Firebase token & creating session)
      if (path === "/api/v1/customer/auth/verify-otp" && httpMethod === "POST") {
        return await customerRoutes.verifyCustomerOtp(parsedBody, sendResponse);
      }

      // Pre-check phone
      if (path === "/api/v1/customer/auth/check-phone" && httpMethod === "POST") {
        return await customerRoutes.checkPhone(parsedBody, sendResponse);
      }
      
      // Fetch Active Gallery Data
      if (path === "/api/v1/customer/events/current" && httpMethod === "GET") {
        return await customerRoutes.getCurrentEvent(headers, sendResponse);
      }
      
      // Submit Photo Selections (Regex used to extract eventId from URL)
      const submitMatch = path.match(/^\/api\/v1\/customer\/events\/([^\/]+)\/submit-selections$/);
      if (submitMatch && httpMethod === "POST") {
        const eventId = submitMatch[1]; // Extracts the dynamic ID from the path
        return await customerRoutes.submitSelections(eventId, parsedBody, headers, sendResponse);
      }
      
      // Revert Photo Selections
      const revertMatch = path.match(/^\/api\/v1\/customer\/events\/([^\/]+)\/revert-selections$/);
      if (revertMatch && httpMethod === "POST") {
        const eventId = revertMatch[1];
        return await customerRoutes.revertSelections(eventId, headers, sendResponse);
      }
    }

    // 4. Fallback 404 Error if the route doesn't match anything above
    return sendResponse(404, { error: `Route ${httpMethod} ${path} not found` });

  } catch (error) {
    // 5. Global Error Handler (Prevents the API from crashing silently)
    console.error("Global API Error:", error);
    return sendResponse(500, { 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};