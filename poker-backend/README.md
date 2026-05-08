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