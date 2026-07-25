<div align="center">

# ⚡ Yogi Digital Studio — AWS Serverless Backend Architecture

The robust, highly secure, event-driven cloud cloud core that powers the real-time photo gallery experience for Yogi Digital Studio web applications and native iOS / Android mobile apps.

<br />

![AWS Cloud](https://img.shields.io/badge/Amazon_AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda_Node_20-FF9900?style=for-the-badge&logo=aws-lambda&logoColor=white)
![DynamoDB](https://img.shields.io/badge/Amazon_DynamoDB-4053D6?style=for-the-badge&logo=amazon-dynamodb&logoColor=white)
![API Gateway](https://img.shields.io/badge/AWS_API_Gateway-FF4F8B?style=for-the-badge&logo=amazon-api-gateway&logoColor=white)
![Serverless Framework](https://img.shields.io/badge/Serverless_v3-FD5750?style=for-the-badge&logo=serverless&logoColor=white)
![Firebase Security](https://img.shields.io/badge/Firebase_Auth_JWT-039BE5?style=for-the-badge&logo=firebase&logoColor=white)
![Express Engine](https://img.shields.io/badge/Express.js_Runtime-000000?style=for-the-badge&logo=express&logoColor=white)

</div>

<br />

---

## 📲 Client Applications & Download Links

This Serverless backend continuously handles thousands of concurrent secure data streams for our official cross-platform client releases:

| Platform | Download / Access Link | Supported Frontend Branch |
| :--- | :--- | :--- |
| **Google Play Store (Android)** | <!-- REPLACE_WITH_YOUR_PLAYSTORE_LINK_HERE --> *(Coming Soon)* | `mobile` (Capacitor Android) |
| **Apple App Store (iOS & iPadOS)** | [Download on App Store](https://apps.apple.com/in/app/yogi-digital-studio/id6790760209) 🚀 | `mobile` (Capacitor iOS) |
| **Live Web Studio & PWA** | [https://yogidigitalstudio.in](https://yogidigitalstudio.in) | `main` (React + Vite Web) |

---

## ☁️ AWS Cloud System Architecture

Our backend employs a serverless, zero-maintenance cloud design pattern on **AWS (ap-south-1 Mumbai)**. By utilizing custom Lambda proxying and Amazon DynamoDB On-Demand billing, the system scales from zero to tens of thousands of concurrent photo downloads in milliseconds.

```mermaid
graph TD
    subgraph Client Requests ["Client App Layer"]
        MOBILE["📱 iOS / Android Apps<br/>(Capacitor WebViews)"]
        WEB["🌐 Web Studio Admin<br/>(& PWA Browsers)"]
    end

    subgraph AWS Edge & Routing ["AWS Cloud Edge & API Gateway"]
        DNS["🌍 Custom Domain Management<br/>(api.yogidigitalstudio.in)"]
        ACM["🔒 AWS Certificate Manager<br/>(TLS / SSL Encryption)"]
        APIG["🚪 Amazon API Gateway<br/>(REST Proxy /{proxy+})"]
    end

    subgraph Serverless Lambda Compute ["AWS Lambda Compute Engines (Node.js 20.x)"]
        PROXY["⚡ Main API Lambda Handler<br/>(src/handlers/apiHandler.js)"]
        AI_LAMBDA["🧠 AI Face Match Processor<br/>(src/handlers/matchFace.js)"]
        EXPRESS["🛠️ Express Routing Engine<br/>(Admin & Customer Modular Routes)"]
    end

    subgraph Storage & Security Layer ["Persistence & Verification"]
        DYNAMO[(🗄️ Amazon DynamoDB Table<br/>YogiStudioData-prod<br/>On-Demand PAY_PER_REQUEST)]
        FIREBASE_ADM["🔐 Firebase Auth Validator<br/>(JWT & Session Tokens)"]
        S3["☁️ AWS S3 Buckets<br/>(Photo Assets & AI Model Bundles)"]
    end

    MOBILE & WEB ===> DNS
    DNS --- ACM
    DNS ===> APIG
    
    APIG --->|ANY /*| PROXY
    APIG --->|POST /api/v1/match-face| AI_LAMBDA

    PROXY ==> EXPRESS
    EXPRESS -.->|Verify JWT Token| FIREBASE_ADM
    EXPRESS ===>|Atomic Query / Put / Delete| DYNAMO
    AI_LAMBDA ===>|Scan & Filter Media| DYNAMO & S3

    classDef edge fill:#232F3E,stroke:#FF9900,stroke-width:2px,color:#fff;
    classDef lambda fill:#FF9900,stroke:#d97706,stroke-width:2px,color:#000;
    classDef storage fill:#4053D6,stroke:#1e3a8a,stroke-width:2px,color:#fff;
    classDef client fill:#039BE5,stroke:#0284c7,stroke-width:2px,color:#fff;
    
    class DNS,ACM,APIG edge;
    class PROXY,AI_LAMBDA,EXPRESS lambda;
    class DYNAMO,FIREBASE_ADM,S3 storage;
    class MOBILE,WEB client;
```

---

## 🗄️ DynamoDB Single-Table Database Schema

Instead of relying on slow relational JOINs, this API utilizes advanced **AWS Single-Table Design** principles. All studio domain entities—Users, Events, Folders, Photos, and Showcase Portfolios—reside inside a single atomic table (`YogiStudioData-${stage}`) indexed via composite Partition Keys (`PK`) and Sort Keys (`SK`).

```mermaid
erDiagram
    STUDIO_TABLE {
        string partitionKey PK "USER#+91... or EVENT#evt_123"
        string sortKey "PROFILE, METADATA, or FOLDER#id"
        string gsi1Partition "Reverse Lookup Key"
        string gsi1Sort "Date / Status sorting"
        json attributes "Flexible Schema"
    }
    
    USER ||--o{ EVENT : "Assigned Studio Event"
    EVENT ||--o{ FOLDER : "Contains Photo Folders"
    FOLDER ||--o{ PHOTO : "Holds High-Res Memories"
    STUDIO ||--o{ PORTFOLIO : "Public Landing Page Showcase"

    USER {
        string partitionKey PK "USER#<PhoneNumber>"
        string sortKey "PROFILE"
        string role "Customer or Studio Admin"
        string createdAt "Registration Epoch"
    }

    EVENT {
        string partitionKey PK "EVENT#<EventID>"
        string sortKey "METADATA"
        string gsi1Partition "USER#<PhoneNumber>"
        string title "Event Title"
    }

    PHOTO {
        string partitionKey PK "EVENT#<EventID>"
        string sortKey "FOLDER#<FolderID>#PHOTO#<PhotoID>"
        string mediaUrl "Secure S3 Download URI"
        boolean isAIReady "Indexed for facial recognition"
    }
```

### Key Query Advantages of this Schema
* **Get All Events for a Customer in 1 Millisecond:** Query Global Secondary Index (`GSI1`) where `GSI1_PK = USER#+919876543210`.
* **Atomic Event Retrieval:** Query Primary Table where `PK = EVENT#evt_123` retrieves the event title, all sub-folders, and every single photograph inside a single network round-trip!

---

## 🔄 API Execution Workflow (Secure Data Stream)

Below is an overview of how our API securely routes admin gallery uploads and client photo viewing requests:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 👨‍💼 Studio Photographer
    participant API as ⚡ Lambda API Handler
    participant DB as 🗄️ DynamoDB Table
    actor Client as 📱 Mobile App Client

    Note over Admin,DB: 🚀 Photographer Event Creation Workflow
    Admin->>API: POST /api/v1/admin/events (Auth Bearer JWT + Client Phone)
    API->>DB: PutItem [PK: EVENT#id, SK: METADATA, GSI1_PK: USER#phone]
    API->>DB: PutItem [PK: EVENT#id, SK: FOLDER#f_1#PHOTO#p_1]
    DB-->>API: ✅ Atomic Transaction Success
    API-->>Admin: Event Published instantly!

    Note over Client,DB: 📱 VIP Client Gallery Viewing Workflow
    Client->>API: GET /api/v1/customer/events (SMS Session Token header)
    API->>API: Validate Firebase JWT Signature & Extract Phone Number
    API->>DB: Query GSI1 Index [GSI1_PK == USER#phone]
    DB-->>API: Return Array of Assigned Studio Events & Covers
    API-->>Client: 🎨 Deliver high-performance gallery manifest to phone!
```

---

## 🔐 Privacy Security & Cascading Integrity

* **Zero-Leak Deletion Support:** Complements Apple App Store Guideline 5.1.1(v). When a user self-terminates their authenticated account identity on mobile, their session authorization expires immediately.
* **Cascading Admin Management (`src/routes/admin.js`):** Should a studio photographer execute a `DELETE /api/v1/admin/users/:phone` request, our custom backend automates a sweeping cascading query—safely stripping out the user profile along with all linked entity associations in DynamoDB without residual orphan items.

---

## 📄 Proprietary Ownership
All cloud infrastructural definitions (`serverless.yml`), Lambda routing models, security frameworks, and API architectures are the confidential and proprietary property of **Yogi Digital Studio**.
