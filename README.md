# ⚡ Yogi Digital Studio — AWS Serverless Backend API

Welcome to the **Yogi Digital Studio Backend Repository**! This project powers the entire data ecosystem for the Yogi Digital Studio web platform and mobile apps. It is a high-performance, event-driven API architecture built on top of **AWS Lambda**, **Amazon DynamoDB**, and the **Serverless Framework (v3)**.

---

## 📲 Client Applications & Download Links

This backend infrastructure actively serves thousands of API transactions for our cross-platform client suite:

| Platform | Download / Access Link | Supported Frontend Branch |
| :--- | :--- | :--- |
| **Google Play Store (Android)** | <!-- REPLACE_WITH_YOUR_PLAYSTORE_LINK_HERE --> *(Coming Soon)* | `mobile` (Capacitor Android) |
| **Apple App Store (iOS & iPadOS)** | <!-- REPLACE_WITH_YOUR_APPSTORE_LINK_HERE --> *(Coming Soon)* | `mobile` (Capacitor iOS) |
| **Live Web Studio & PWA** | [https://yogidigitalstudio.in](https://yogidigitalstudio.in) | `main` (React + Vite Web) |

---

## 🏗️ Cloud Infrastructure & Tech Stack

- **Cloud Provider:** Amazon Web Services (AWS)
- **Runtime Environment:** Node.js 20.x (Hosted on AWS Lambda)
- **Database Architecture:** Amazon DynamoDB (Single-Table Design with Pay-Per-Request On-Demand Scaling)
- **Infrastructure as Code (IaC):** Serverless Framework (`serverless.yml`)
- **API Routing:** Custom Proxy Lambda handler (`src/handlers/apiHandler.js`) mapped to API Gateway (`/{proxy+}`) with CORS enabled.
- **Domain & SSL Management:** `serverless-domain-manager` serving live over custom HTTPS domain: `api.yogidigitalstudio.in`.
- **Security:** Integrated JWT authentication token validation & Firebase Auth synchronization.

---

## 🔗 Integration with Frontend & Mobile Architectures

Our companion frontend repository (`Yogi_Studio_Frontend`) consumes this backend through two distinct production targets:
1. **The `main` Branch (Web & PWA Client):** Serves optimized endpoints for desktop studio admins to upload galleries and manage operations.
2. **The `mobile` Branch (iOS & Android Apps):** Specially integrated with native mobile wrappers. This API natively supports cross-origin requests from iOS WKWebView and Android WebView instances, delivering optimized image metadata, rapid event verification, and secure OTP authorization to iPhones, iPads, and Android devices.

---

## 📦 Core Modules & API Capabilities

### 🏢 Admin & Studio Operations (`src/routes/admin.js`)
- **User & Event Cascading:** Create, inspect, and manage customer accounts. Supports cascading delete operations—deleting a user profile completely removes associated event bindings in a clean atomic step.
- **Event & Folder Structuring:** Generates and maintains structured photo albums, subfolders, and cover assets.
- **Portfolio Curation:** Manage high-resolution highlight reels and promotional banners for the studio public landing page (`src/routes/portfolio.js`).
- **AI Photo Model Execution:** Handles model metadata generation and processing pipelines for advanced digital enhancements.

### 👥 Client & Attendee Services (`src/routes/customer.js`)
- **Phone Verification & OTP Verification:** Rapid checks (`/api/v1/customer/auth/check-phone`) and token validation to enable frictionless SMS OTP logins.
- **Gallery & Memory Access:** Lightning-fast metadata delivery of high-res photos and event directories.
- **Privacy & Deletion Transparency:** Supports customer self-serve privacy initiatives by coordinating account disconnects securely with Firebase Auth client state.

---

## 🚀 Getting Started & Deployment

### 1️⃣ Prerequisites
- **Node.js** (v20.x recommended)
- **AWS CLI** configured with an IAM profile possessing Lambda, DynamoDB, API Gateway, and ACM permissions.
- **Serverless Framework CLI** installed globally (`npm install -g serverless`).

### 2️⃣ Local Installation & Development
```bash
# Clone the repository and navigate to the backend directory
git clone https://github.com/yoneshmurugan/Yogi_Studio_Backend.git
cd Yogi_Studio_Backend

# Install required Node dependencies
npm install
```

To run the API locally on your dev machine without hitting AWS cloud costs, use **Serverless Offline**:

```bash
npx serverless offline
```
The local emulation server will be active at `http://localhost:3000`.

### 3️⃣ Cloud Deployment (AWS ap-south-1)

To deploy or update the serverless cloud infrastructure on AWS:

```bash
# Deploy to standard development stage
npx serverless deploy --stage dev

# Deploy to live production stage (updates api.yogidigitalstudio.in)
npx serverless deploy --stage prod
```

---

## 🛡️ Database Schema Summary
The architecture uses an AWS DynamoDB Table (`YogiStudioData-${stage}`) structured around composite primary keys:
- **Partition Key (`PK`):** Entity Identifier (e.g., `USER#<phone>`, `EVENT#<id>`, `PORTFOLIO#item`)
- **Range Key (`SK`):** Metadata subtype or timestamp sorting.
- **Global Secondary Index (`GSI1`):** Enables robust reverse-querying across events, users, and portfolio statuses.

---

## 📄 License & Confidentiality
This backend architectural codebase, business logic, and API design are strictly proprietary to **Yogi Digital Studio**.
