const express = require("express");
const router = express.Router();
const {
  createTestUser,
  getAllUsers,
  getMyActiveHand,
  getMyGameHistory,
  getMyProfile,
} = require("../controllers/userController");
const { protectUser } = require("../middleware/auth");
const { validateRequestWithAuth } = require("../middleware/validateRequest");

router.post("/test-user", createTestUser);
router.get("/me", ...validateRequestWithAuth(protectUser), getMyProfile);
router.get(
  "/me/game-history",
  ...validateRequestWithAuth(protectUser),
  getMyGameHistory
);
router.get(
  "/me/active-hand",
  ...validateRequestWithAuth(protectUser),
  getMyActiveHand
);
router.get("/", getAllUsers);

module.exports = router;
