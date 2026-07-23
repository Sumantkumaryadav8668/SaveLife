# RapidAid - Emergency Response Platform

RapidAid is a full-stack, real-time Emergency Response Platform connecting citizens in distress with nearby emergency services (Hospitals, Police, and Fire/Rescue Teams) instantly. The platform integrates real-time GPS tracking, offline syncing capability, administrative audit trails, and hospital operational inventory controls.

## 🚀 Key Features

1. **Role-Locked Auth**: Five roles (`user`, `hospital_admin`, `police`, `rescue_person`, `system_admin`) locked on signup. Promoted to `system_admin` only via audit-logged administrative actions.
2. **Geospatial Dispatch Matching**: SOS triggers compute the nearest 1–3 agencies using MongoDB `2dsphere` indexes (`$nearSphere` query) to minimize alert fatigue.
3. **Double-State SOS Alerts**:
   - **Standard SOS**: Dispatches coordinates to all nearby responders, repeating every 5 minutes.
   - **Silent SOS**: Dispatches coordinates to the nearest responder. Auto-escalates to next-nearest teams if not confirmed within 2 minutes.
4. **Offline GPS Sync**: Integrates a Service Worker and IndexedDB cache database. If network falls offline, location coordinates queue locally and auto-sync when connection restores.
5. **Hospital Management Module**: Controls bed counts, general and ICU vacancies, blood banks inventory (A+, B-, etc.), ambulance fleet states, and doctor rosters.
6. **Platform Moderation & Audit**: Temporary suspensions or permanent blocks for fake SOS abuse, pending Aadhaar ID verification reviews, chatbot escalations, and full operational audit logs.

---

## 🛠️ Architecture & Folder Structure

```
Smart Desister/
├── client/                     # Vite + React Frontend Client
│   ├── public/                 # Static assets & sw.js Service Worker
│   └── src/
│       ├── components/         # MapContainer, ChatbotWidget, FloatingSOSButton
│       ├── features/           # Modularized views
│       ├── layouts/            # Dashboard layout shell with online/offline badge
│       ├── models/
│       │   └── api.js          # Centralized Axios Client (Auth, SOS, Admin endpoints)
│       ├── routes/             # Protected routes guards
│       ├── store/              # Zustand state stores (useAuthStore, useSOSStore)
│       └── utils/              # IndexedDB cache queue helpers
└── server/                     # Node.js + Express Backend Server
    └── src/
        ├── config/             # DB & Sockets configurations
        ├── controllers/        # Auth, SOS, Hospital, Admin controllers
        ├── middlewares/        # JWT auth guard, uploads (Multer)
        ├── models/             # Mongoose schemas (User, Entity, SOSCase, AuditLog)
        ├── services/           # Geospatial lookup, auto-escalation timer rules
        ├── sockets/            # Socket.io listeners
        └── tests/              # Automated verification scripts
```

---

## ⚙️ Environment Variables

### Server (`server/.env`)
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/rapidaid
JWT_SECRET=rapidaid_jwt_access_secret_key_12345
JWT_REFRESH_SECRET=rapidaid_jwt_refresh_secret_key_67890
CLIENT_URL=http://localhost:5173
```

### Client (`client/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 🏎️ Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on `mongodb://127.0.0.1:27017`

### 1. Database Setup & Seeding
In the `server` directory, run the database seeder to establish mock operational hospitals, police hubs, rescue bases, and template accounts:
```bash
cd server
npm install
npm run seed
```

#### Seed Accounts:
* **System Admin**: `admin@rapidaid.com` / `adminpassword`
* **Hospital Admin**: `hospital@rapidaid.com` / `hospitalpassword`
* **Police Dispatcher**: `police@rapidaid.com` / `policepassword`
* **Rescue Agent**: `rescue@rapidaid.com` / `rescuepassword`
* **Distress User (Citizen)**: `user@rapidaid.com` / `userpassword`

### 2. Run the Backend
```bash
npm run start
```
Starts backend server on port `5000`.

### 3. Run the Frontend
In the `client` directory:
```bash
cd client
npm install
npm run dev
```
Starts development hot-reload client on `http://localhost:5173`.

---

## 🧪 Verification & Testing
To execute the automated validation tests for geo-matching distance calculations, JWT signatures, and silent SOS auto-escalation timer rules:
```bash
cd server
node src/tests/sos.test.js
```
 All tests should return green/passed markers.
