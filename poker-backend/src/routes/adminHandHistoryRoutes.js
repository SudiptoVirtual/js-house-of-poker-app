const express = require("express");
const router = express.Router();

const {
  getHands,
  getHandById,
  getHandEvents,
} = require("../controllers/adminHandHistoryController");

const { protectAdmin } = require("../middleware/adminAuth");
const { validateRequestWithAuth } = require("../middleware/validateRequest");

const {
  handHistoryListQueryRules,
  handHistoryIdParamRules,
} = require("../validators/adminHandHistoryValidators");

router.get(
  "/",
  ...validateRequestWithAuth(protectAdmin, handHistoryListQueryRules),
  getHands
);

router.get(
  "/:id",
  ...validateRequestWithAuth(protectAdmin, handHistoryIdParamRules),
  getHandById
);

router.get(
  "/:id/events",
  ...validateRequestWithAuth(protectAdmin, handHistoryIdParamRules),
  getHandEvents
);

module.exports = router;