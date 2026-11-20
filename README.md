# AKE Rice (Ashok Kavin Rice) — MERN Stack Transformation

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-teal.svg)](https://tailwindcss.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg)](https://mongodb.com)
[![Status](https://img.shields.io/badge/Status-100%25%20Migrated-success.svg)]()

> A production-grade, enterprise-ready MERN Stack web application transformed from the legacy codebase (`D:\kavin\Ake`) into `D:\kavin\AKENew`, preserving 100% of existing features, business rules, pricing logic, payment verification workflows, sequential order IDs, bilingual recipe collections, WhatsApp integrations, offline POS tracking, and automated weekly business intelligence reports.

---

## 🌟 Key Credentials & Contact Information

| Parameter | Configuration Value | Description / Destination |
| :--- | :--- | :--- |
| **Official Brand Name** | **AKE Rice — Ashok Kavin Rice** | Koppampatty Seeraga Samba Rice |
| **FSSAI License** | `22423545000216` | Displayed legally in website footer & receipts |
| **Official WhatsApp** | `+91 9176049099` | 1-Click Order confirmation dispatch |
| **UPI Payment ID** | `kaviyansellappan15@oksbi` | Name: **AKE Rice** with dynamic & static QR flow |
| **Admin Default Login** | `Kavin` / `Ashok Kumar` | Password: `AshokKavinRice` \| Admin OTP: `848910` |
| **Customer Access** | **Direct Guest Checkout** | No login or registration required for customers |

---

## 🌾 Updated Product Pricing & Dynamic Catalog

- **1 KG Rice Pouch (`1kg`)**: **₹195** / pouch (Fresh aroma-lock zipper pouch).
- **25 KG Bulk Bag (`25kg`)**: **₹4,625** / bag (Special wholesale rate of **₹185 / KG**).
- **Dynamic Product Management**: The administrator can dynamically add, edit, price, and toggle availability of rice packages directly in the Admin Dashboard.
- **Sequential Order IDs**: `AKE000001`, `AKE000002`, `AKE000003`... (Zero duplicates guaranteed with backend atomic sequence).

---

## 🚀 Quick Start & Launch

### Option 1: One-Click Windows Launchers
Double-click any of the following script files in the project root:
- `start-all.bat` — Starts both Backend (port 5000) and Frontend (port 5173) in separate windows.
- `start-server.bat` — Starts the Express backend server (`http://localhost:5000`).
- `start-client.bat` — Starts the Vite React development server (`http://localhost:5173`).
- `run-tests.bat` — Executes the automated 12-suite end-to-end integration test.

### Option 2: Command Line (NPM Scripts)

#### 1. Start Backend:
```bash
cd server
npm run dev
# Server will run on http://localhost:5000
```

#### 2. Start Frontend:
```bash
cd client
npm run dev
# Client will run on http://localhost:5173
```

#### 3. Run Automated Tests:
```bash
npm run test
# Runs node tests/direct_test.js (All 12 test suites)
```

---

## 🛠️ Architecture & Technology Stack

```
d:\kavin\AKENew\
├── client/                     # Vite + React 18 + Tailwind CSS Frontend
│   ├── public/assets/          # 21 Migrated high-res photos, packets & QR
│   ├── src/
│   │   ├── components/         # Reusable UI (Navbar, Footer, LightboxModal)
│   │   ├── context/            # AuthContext, ThemeContext, ToastContext
│   │   ├── pages/              # Home, About, Order, Recipes, Feedback, Account, Admin, Login
│   │   ├── services/           # Axios REST API services (auth, order, feedback, admin)
│   │   └── utils/              # 10 Bilingual Biryani Recipes with dynamic guest scaler math
│   └── dist/                   # Production-ready built static bundle
├── server/                     # Node.js + Express.js REST API Backend
│   ├── config/                 # db.js, storage.js (Multer), modelAdapter.js (Dual-Mode)
│   ├── controllers/            # auth, product, order, sales, feedback, admin, upload
│   ├── middleware/             # authMiddleware (JWT + Role RBAC), errorHandler, rateLimiter
│   ├── models/                 # User, Product, Order, Sale, Feedback, Counter, WeeklyReport
│   ├── routes/                 # Express API routes
│   ├── services/               # orderIdService, otpService, whatsappService, emailService
│   ├── data/                   # Persistent local document storage (Fail-safe mode)
│   └── uploads/                # File storage abstraction (screenshots, avatars)
├── migration/                  # Migration scripts & original data backups
│   ├── backup/                 # Original customers.json, feedback.json, sessions.json
│   └── migrate.js              # Idempotent migration script
└── tests/
    └── direct_test.js          # Comprehensive 12-suite end-to-end integration test
```

---

## 🛡️ Dual-Mode Database Architecture (Fail-Safe)

The backend features an intelligent dual-mode storage adapter (`server/config/modelAdapter.js`):
1. **Live MongoDB / Atlas Mode**: When a MongoDB daemon or Atlas cluster is reachable via `MONGODB_URI` in `.env`, the system automatically connects and leverages native Mongoose ODM.
2. **Persistent Document Store Mode**: If MongoDB is not running locally, the system automatically activates zero-stall, atomic local file persistence inside `server/data/*.json`. It provides 100% full query chaining compatibility (`.find()`, `.findOne()`, `.findById()`, `.sort()`, `.limit()`, `.populate()`, `.lean()`, `.countDocuments()`), ensuring the application never crashes or stalls even in offline or air-gapped environments.

---

## 📋 Complete Feature Migration Checklist

| Feature Area | Legacy Feature (`D:\kavin\Ake`) | MERN Implementation (`D:\kavin\AKENew`) | Status |
| :--- | :--- | :--- | :--- |
| **Storefront** | Traditional Hero, Koppampatty Story, FSSAI Badge | Responsive Hero, Heritage story, Live FSSAI badge, dynamic Trust Cards | ✅ Migrated |
| **Branding & Assets** | 21 assets (Packets, UPI QR, About photos, Recipes) | Copied to `client/public/assets` with Lightbox Modal & WebP compatibility | ✅ Migrated |
| **Product Catalog** | 1 KG (₹200) & 25 KG (₹4,750 / ₹190 per KG) | Full REST API (`/api/products`), Admin-configurable price & stock | ✅ Migrated |
| **Unified Auth** | Scattered admin password & customer sessions | Universal modal/page supporting Mobile OTP, Google OAuth & Admin credentials | ✅ Migrated |
| **Security & OTP** | Plain text customer phone tracking | Bcrypt-hashed 6-digit OTP, 5-min expiration, 3 attempts limit, 60s resend cooldown | ✅ Migrated |
| **Sequential IDs** | Client-side/adhoc `AKE000001` generation | Backend atomic MongoDB counter sequence with concurrency locks | ✅ Migrated |
| **Order Flow (COD)** | Cash on delivery ordering form | Multi-step interactive checkout, instant sequential ID, address validation | ✅ Migrated |
| **Order Flow (UPI)** | Static QR display with manual screenshot upload | Interactive UPI flow (`kaviyansellappan15@oksbi`), UTR input, Multer cloud/disk upload | ✅ Migrated |
| **Payment Verification** | Manual offline screenshot inspection | Admin Verification Portal: View proof in lightbox, One-Click 'Verify' or 'Reject' | ✅ Migrated |
| **Delivery Tracking** | Unsynchronized order statuses | Full lifecycle: Order Placed → Confirmed → Processing → Out for Delivery → Delivered | ✅ Migrated |
| **WhatsApp Integration**| WhatsApp direct message with specific format | Exact formatted message generator & 1-click WhatsApp redirect to `+91 9176049099` | ✅ Migrated |
| **Customer Feedback** | Unmoderated review submissions | Moderated submission, Admin approve/reject/hide, Verified Purchase badges | ✅ Migrated |
| **Biryani Recipes** | 10 authentic recipes in English & Tamil | 10 recipes with Tamil/English toggles, Dynamic Guest Scaler math, & Print styling | ✅ Migrated |
| **POS Sales Tracking** | Adhoc offline sales counter entries | Full POS module with Shop name, Area, KG rate, Payment mode, and analytics sync | ✅ Migrated |
| **Admin Dashboard** | Basic static tables | Interactive KPI cards, Area revenue breakdown, 7-Day sales trend, Recent Orders | ✅ Migrated |
| **Customer Registry** | `customers.json` | Full Customer directory with total orders, total spend, address, and call/WhatsApp links | ✅ Migrated |
| **Reports & Export** | Client-side table dump | Backend filtered reporting with one-click instant CSV export | ✅ Migrated |
| **Automated Reports** | Scheduled weekly summary | `emailService.js` automated Sunday 9 PM cron dispatch to `kaviyansellappan15@gmail.com` | ✅ Migrated |
| **Theme Support** | Basic styling | Full Light / Dark theme toggle with persistent preference state in Context | ✅ Migrated |

---

## 🔒 Security Best Practices Implemented

1. **Helmet & CORS Protection**: Cross-origin requests restricted to client origin, secure HTTP headers enabled.
2. **Rate Limiting**: Prevent brute-force attacks on OTP endpoints (`/api/auth/send-otp`, `/api/auth/verify-otp`).
3. **JWT Access Tokens**: Stateless authentication with role-based access control (`customer`, `admin`).
4. **File Storage Abstraction**: Multipart file uploads sanitized via Multer into `/uploads` with MIME-type filtering (PNG, JPG, WEBP only), avoiding high-overhead Base64 in databases.
5. **Role-Based API Protection**: Administrator routes (`/api/admin/*`, `/api/orders/:id/payment`, `/api/sales`) strictly restricted to authenticated administrators.

---

## 🌐 Production Deployment Guide (GitHub + Vercel)

### 1. Push to GitHub
1. Initialize Git in the project root:
   ```bash
   git init
   git add .
   git commit -m "feat: complete production-ready AKE Rice MERN stack"
   git branch -M main
   ```
2. Create a new repository on GitHub (private or public) and push:
   ```bash
   git remote add origin https://github.com/<your-username>/ake-rice.git
   git push -u origin main
   ```

> **Security Note**: Real `.env` files containing database passwords, SMTP credentials, and JWT keys are automatically ignored by `.gitignore` and will never be pushed to GitHub. Template files (`.env.example`, `server/.env.example`, `client/.env.example`) are safely tracked.

### 2. Live Frontend Deployment
The frontend is already live in production:
- **Production URL**: `https://ake-ricestore.vercel.app/`
- **Backend API Integration**: Connects via `VITE_API_URL` environment variable pointing to the deployed backend.

### 3. Deploy Backend to Vercel (Serverless REST API)
The backend REST API in `server/` is pre-configured for Vercel Serverless deployment via `api/index.js` and `vercel.json`:
- **Framework Preset**: Other
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: (leave empty / default)
- **CORS Allowed Origin**: Automatically accepts requests from `https://ake-ricestore.vercel.app`
- **Environment Variables**: Import all variables from `.env.vercel` or `server/.env.example` in Vercel Project Settings:
  - `MONGODB_URI`: Your production MongoDB Atlas connection string
  - `JWT_SECRET`: A secure random cryptographic key
  - `CLIENT_URL`: `https://ake-ricestore.vercel.app`
  - `SMTP_USER` & `SMTP_PASS`: Gmail App Password for customer OTPs
  - `UPI_ID`: Payment destination (`kaviyansellappan15@oksbi`)

---

## 👨‍💻 Developed for
**AKE Rice — Ashok Kavin Rice**  
Koppampatty, Tamil Nadu, India.
