const express = require("express");
const router = express.Router();

const {
  authenticateWithGoogle,
  registerUser,
  loginUser,
  getMe,
  logoutUser,
} = require("../controllers/authController");

const { protectUser } = require("../middleware/auth");
const {
  validateRequest,
  validateRequestWithAuth,
} = require("../middleware/validateRequest");

const {
  registerUserRules,
  loginUserRules,
  googleAuthRules,
} = require("../validators/authValidators");

router.post("/register", ...validateRequest(registerUserRules), registerUser);
router.post("/login", ...validateRequest(loginUserRules), loginUser);
router.post("/google", ...validateRequest(googleAuthRules), authenticateWithGoogle);
router.get("/me", ...validateRequestWithAuth(protectUser), getMe);
router.post("/logout", ...validateRequestWithAuth(protectUser), logoutUser);

module.exports = router;
