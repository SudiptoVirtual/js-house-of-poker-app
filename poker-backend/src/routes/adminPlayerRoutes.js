const express = require("express");
const router = express.Router();

const adminPlayerController = require("../controllers/adminPlayerController");
const { protectAdmin } = require("../middleware/adminAuth");
const { validateRequestWithAuth } = require("../middleware/validateRequest");

const {
  playerListQueryRules,
  playerIdParamRules,
  updatePlayerStatusRules,
  updatePlayerChipsRules,
} = require("../validators/adminPlayerValidators");

router.get(
  "/",
  ...validateRequestWithAuth(protectAdmin, playerListQueryRules),
  adminPlayerController.getPlayers
);

router.get(
  "/:id",
  ...validateRequestWithAuth(protectAdmin, playerIdParamRules),
  adminPlayerController.getPlayerById
);

router.patch(
  "/:id/status",
  ...validateRequestWithAuth(protectAdmin, updatePlayerStatusRules),
  adminPlayerController.updatePlayerStatus
);

router.patch(
  "/:id/chips",
  ...validateRequestWithAuth(protectAdmin, updatePlayerChipsRules),
  adminPlayerController.updatePlayerChips
);

router.get(
  "/:id/hands",
  ...validateRequestWithAuth(protectAdmin, playerIdParamRules),
  adminPlayerController.getPlayerHands
);

router.get(
  "/:id/transactions",
  ...validateRequestWithAuth(protectAdmin, playerIdParamRules),
  adminPlayerController.getPlayerTransactions
);

module.exports = router;