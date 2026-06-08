// src/handlers/apiHandler.js

// We will build these controller files in Phase 3
const adminRoutes = require('../routes/admin');
const customerRoutes = require('../routes/customer');

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
      
      // Admin OTP/Login Validation
      if (path === "/api/v1/admin/users/verify-otp" && httpMethod === "POST") {
        return await adminRoutes.verifyOtp(parsedBody, sendResponse);
      }
      
      // Event Management
      if (path === "/api/v1/admin/events" && httpMethod === "POST") {
        return await adminRoutes.createEvent(parsedBody, sendResponse);
      }
      if (path === "/api/v1/admin/events" && httpMethod === "GET") {
        return await adminRoutes.listEvents(queryStringParameters, sendResponse);
      }

      // Add more admin routes here as needed...
    }

    // ---- B. CUSTOMER ROUTES ----
    if (path.startsWith("/api/v1/customer")) {
      
      // Customer Auth (Validating Firebase token & creating session)
      if (path === "/api/v1/customer/auth/verify-otp" && httpMethod === "POST") {
        return await customerRoutes.verifyCustomerOtp(parsedBody, sendResponse);
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