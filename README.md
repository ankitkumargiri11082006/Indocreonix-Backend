# 🏛️ Indocreonix Backend — Enterprise Management Core

A scalable and secure Node.js & Express backend driving the Indocreonix ecosystem. This server handles mission-critical operations, from identity management to automated project ordering and cloud-based asset orchestration.

---

## 🚀 Core Functionalities

### 1. Identity & Security
- **Multi-Role RBAC (Role-Based Access Control):** Granular permissions for `superadmin`, `admin`, `editor`, and `viewer`.
- **JWT Authentication:** Secure stateless session management with HTTP-only cookie support.
- **Advanced Security:** Implementation of `helmet` for header security, `cors` for origin protection, and `express-rate-limit` to prevent brute-force attacks.

### 2. Project Ordering System
- **Intelligent Intake:** Captures detailed project briefs, budget ranges, and timelines.
- **PRD Asset Management:** Automated upload and categorization of PRD (PDF) and supporting documents to Cloudinary.
- **Email Automation:** Transactional email triggers via Resend for client confirmations and internal team notifications.

### 3. Career & Talent Portal
- **Application Engine:** Specialized routes for Job and Internship applications.
- **CV Processing:** Validated PDF uploads with secure cloud storage mapping.

### 4. Admin Ecosystem
- **Dashboard Analytics:** Aggregated insights into site health and lead volume.
- **Audit Logging:** Systematic tracking of administrative actions for compliance and security.
- **Media Controller:** Centralized management of website assets via Cloudinary integration.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime** | Node.js (LTS) | High-performance asynchronous execution |
| **Framework** | Express.js | Robust middleware-driven routing |
| **Database** | MongoDB | Document-oriented data persistence |
| **ORM** | Mongoose | Schema-based data modeling and validation |
| **Storage** | Cloudinary | Global CDN for media and documents |
| **Email** | Resend | High-deliverability transactional communications |

---

## 📊 Data Models (Schemas)

### **`User`**
| Field | Type | Description |
| :--- | :--- | :--- |
| `name`, `email` | String | Identity credentials |
| `role` | Enum | superadmin, admin, editor, viewer |
| `permissions` | Object | Toggles for Dashboard, Projects, Orders, etc. |
| `avatarUrl` | String | Managed profile asset |

### **`ProjectOrder`**
| Field | Type | Description |
| :--- | :--- | :--- |
| `projectCategory` | Enum | Website, App, Custom Software, etc. |
| `prdUrl` | String | Secure link to the PRD (PDF) on Cloudinary |
| `status` | Enum | new, qualified, in_discussion, won, lost |
| `targetBudget` | String | Client's expected investment range |

---

## ⚙️ Operation & Setup

### **1. Environment Configuration**
Copy `.env.example` to `.env` and configure the following:
- `MONGODB_URI`: Connection string for your cluster.
- `JWT_SECRET`: High-entropy string for token signing.
- `CLOUDINARY_*`: API keys for media storage.
- `RESEND_API_KEY`: Authorization for email delivery.

### **2. Commands**
```bash
# Install dependencies
npm install

# Start development server (with nodemon)
npm run dev

# Start production server
npm start
```

Default access point: `http://localhost:5000/api`

---

## 📝 Developer Notes
The project was architected using **Antigravity (Gemini 2.0 Pro)** for high-precision logic and security implementation. The codebase follows modern ES Modules syntax and uses a structured middleware approach for clean concerns separation.
