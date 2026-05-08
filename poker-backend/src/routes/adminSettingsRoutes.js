const express = require("express");
const router = express.Router();

const {
  getGameSettings,
  updateGameSettings,
  getSystemSettings,
  updateSystemSettings,
} = require("../controllers/adminSettingsController");

const { protectAdmin } = require("../middleware/adminAuth");
const { validateRequestWithAuth } = require("../middleware/validateRequest");

const {
  updateGameSettingsRules,
  updateSystemSettingsRules,
} = require("../validators/adminSettingsValidators");

router.get(
  "/game",
  ...validateRequestWithAuth(protectAdmin),
  getGameSettings
);

router.patch(
  "/game",
  ...validateRequestWithAuth(protectAdmin, updateGameSettingsRules),
  updateGameSettings
);

router.get(
  "/system",
  ...validateRequestWithAuth(protectAdmin),
  getSystemSettings
);

router.patch(
  "/system",
  ...validateRequestWithAuth(protectAdmin, updateSystemSettingsRules),
  updateSystemSettings
);

module.exports = router;