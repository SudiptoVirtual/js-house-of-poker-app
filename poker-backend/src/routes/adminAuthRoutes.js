const express = require("express");
const router = express.Router();

const {
  loginAdmin,
  getMe,
} = require("../controllers/adminAuthController");

const { protectAdmin } = require("../middleware/adminAuth");
const { validateRequest, validateRequestWithAuth } = require("../middleware/validateRequest");
const { adminLoginRules } = require("../validators/authValidators");

router.post("/login", ...validateRequest(adminLoginRules), loginAdmin);
router.get("/me", ...validateRequestWithAuth(protectAdmin), getMe);

module.exports = router;