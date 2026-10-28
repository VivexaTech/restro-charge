# RestroCharge - Complete Multi-Tenant Restaurant Management & QR Ordering SaaS
**Developed and Operated by Vivexa Tech**

RestroCharge is an enterprise-grade multi-tenant SaaS platform built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Firebase** (Firestore, Authentication, and Admin SDK).

It powers four major experiences in a single, high-performance Next.js codebase:
1. **Public Marketing Website & Restaurant Directory** (`/`, `/pricing`, `/restaurants`, `/restaurants/request`)
2. **Branded Public Restaurant Websites** under subpaths (e.g., `https://restrocharge.vivexatech.in/laziz`)
3. **Mobile-First Customer QR Ordering & Real-Time Tracking** (`/order/[restaurantSlug]/[tableCode]`)
4. **Operations & Governance Panels**:
   - **Vivexa Tech Super Admin Panel** (`/super-admin`): Exclusive QR code generation, onboarding requests, central billing/GST rules, and subscription governance.
   - **Restaurant Admin Dashboard** (`/dashboard`): Menu management, category sorting, staff permissions, and website customizer.
   - **Staff & Kitchen Order Display (KDS)** (`/staff`, `/staff/kitchen`): Live order stream with audio alert chimes and touch-friendly ticket lifecycle.

---

## 🚀 Key Architectural & Business Principles

- **Vivexa Tech Exclusive QR Issuance**:
  Only authorized Vivexa Tech team members can create and issue restaurant table QR codes. Restaurant admins have read-only view access. This is enforced through server-side authorization.
- **Zero Food-Order Payment Gateway**:
  RestroCharge does **not** collect payments for customer food orders. Diners pay restaurants directly at the counter or to their waiter. RestroCharge calculates and displays the bill only.
- **Razorpay for RestroCharge Subscriptions Only**:
  Razorpay is integrated strictly for restaurant software subscriptions. Auto-recurring charges are disabled; subscriptions are renewed manually or via 1-time Razorpay payments.
- **3-Day Subscription Grace Period**:
  Subscriptions expiring receive an automatic 3-day grace period. If renewed within grace, public sites remain active. If past grace, public ordering is paused.
- **Tamper-Proof Backend Billing Engine**:
  Food order totals and item prices are fetched strictly from the trusted database. Client price modifications are discarded.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS, Class Variance Authority, Tailwind Merge
- **Icons**: Lucide React
- **Notifications**: Sonner Toasts & Web Audio API synthesized chimes
- **Database & Auth**: Firebase Firestore & Firebase Authentication
- **Payments**: Razorpay Node SDK (Subscription renewals)
- **Email**: Resend Transactional Email SDK
- **Media**: Cloudinary SDK (with local image transformation fallbacks)
- **QR Code**: `qrcode` (Vector SVG and 512px High-Res PNG)

---

## 🔑 Demo Personas & Fast Switcher

The public navbar includes a persistent persona switcher for evaluating different roles:
- **Super Admin**: `admin@vivexatech.in` (Access `/super-admin`)
- **Restaurant Owner**: `owner@lazizbiryani.com` (Access `/dashboard`)
- **Kitchen Chef**: `kitchen@lazizbiryani.com` (Access `/staff/kitchen`)
- **Customer Guest**: Direct access to `/order/laziz/table-01` (No login required)

---

## 📦 Setup & Local Development

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd RestoHub
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Run Automated Workflow Tests
```bash
npm test
```
The test suite validates:
- Central billing & tax calculation engine
- 3-day grace period enforcement and expiry extension
- QR code generation and Super Admin permissions
- End-to-end customer order placement & tamper protection

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm start
```

---

## 🛡️ Security & Tenant Isolation

- **Client vs Server Boundary**: API keys for Razorpay, Cloudinary secret, and Resend are kept strictly server-side.
- **Tenant Isolation**: All Firestore queries and mutations scope records by `restaurantId`.
- **Audit Logs**: Administrative overrides, manual subscription extensions, and QR issuances are captured in `adminAuditLogs`.

---

© 2026 RestroCharge. Developed & Operated by Vivexa Tech.
