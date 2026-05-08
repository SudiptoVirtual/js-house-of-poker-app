const express = require("express");
const router = express.Router();

const {
  getLiveTables,
  getLiveTableById,
} = require("../controllers/adminLiveController");

const { protectAdmin } = require("../middleware/adminAuth");
const { validateRequestWithAuth } = require("../middleware/validateRequest");

const {
  liveTableListQueryRules,
  liveTableIdParamRules,
} = require("../validators/adminLiveValidators");

router.get(
  "/tables",
  ...validateRequestWithAuth(protectAdmin, liveTableListQueryRules),
  getLiveTables
);

router.get(
  "/tables/:id",
  ...validateRequestWithAuth(protectAdmin, liveTableIdParamRules),
  getLiveTableById
);

module.exports = router;