# Poker Backend API

Backend API for the Poker App.  
This project handles player authentication, admin authentication, dashboard stats, player management, and table management.

---

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Socket.IO
- bcrypt
- dotenv
- cors

---

## Compatible Versions

This backend is currently tested and working with:

- **Node.js:** `v20.17.0`
- **npm:** `10.8.2`

Recommended for this repo:

- Node.js `20.17.0`
- npm `10.8.2`

---

## Environment Variables

Create a `.env` file for local development and configure the same variables in your production environment.

### Required

- `MONGODB_URI` - MongoDB connection string used by the API and seed script.
- `JWT_SECRET` - Secret used to sign and verify admin/player JWTs.
- `ALLOWED_ORIGINS` - Comma-separated list of browser origins that may call the Express API and Socket.IO server, for example `https://www.jshouseofpoker.com,https://admin.jshouseofpoker.com`. This must be set in production; do not use `*`.

### Optional

- `NODE_ENV` - Set to `production` in production. When this is not `production`, the backend also allows local development origins such as `http://localhost:3000`, `http://localhost:5173`, `http://localhost:8081`, and their `127.0.0.1` equivalents.
- `PORT` - HTTP port for the Express and Socket.IO server. Defaults to `5000`.
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` - Firebase Admin credentials, if Firebase-authenticated flows are enabled.
- `USER_LOGIN_MAX_ATTEMPTS` and `USER_LOGIN_LOCK_MINUTES` - Login throttling settings for player accounts.
- `POKER_SMALL_BLIND`, `POKER_BIG_BLIND`, and `POKER_DEFAULT_BUY_IN` - Poker table defaults.

Example production CORS configuration:

```bash
NODE_ENV=production
ALLOWED_ORIGINS=https://www.jshouseofpoker.com,https://admin.jshouseofpoker.com
```

---

## Project Structure

```bash
src/
  config/
    db.js
  controllers/
    adminAuthController.js
    adminDashboardController.js
    adminPlayerController.js
    adminTableController.js
    authController.js
    userController.js
  middleware/
    adminAuth.js
    auth.js
  models/
    Admin.js
    AuditLog.js
    GameTable.js
    HandHistory.js
    Transaction.js
    User.js
  routes/
    adminAuthRoutes.js
    adminDashboardRoutes.js
    adminPlayerRoutes.js
    adminTableRoutes.js
    authRoutes.js
    userRoutes.js
  utils/
    generateToken.js
    generateUserToken.js
  scripts/
    seedAdmin.js
  index.js
.env
package.json
README.md