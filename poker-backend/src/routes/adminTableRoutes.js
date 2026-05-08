const express = require("express");
const router = express.Router();

const {
  createTable,
  getTables,
  getTableById,
  updateTableStatus,
  updateTableConfig,
  removePlayerFromTable,
} = require("../controllers/adminTableController");

const { protectAdmin } = require("../middleware/adminAuth");
const { validateRequestWithAuth } = require("../middleware/validateRequest");

const {
  createTableRules,
  tableListQueryRules,
  tableIdParamRules,
  updateTableStatusRules,
  updateTableConfigRules,
  removePlayerFromTableRules,
} = require("../validators/adminTableValidators");

router.post(
  "/",
  ...validateRequestWithAuth(protectAdmin, createTableRules),
  createTable
);

router.get(
  "/",
  ...validateRequestWithAuth(protectAdmin, tableListQueryRules),
  getTables
);

router.get(
  "/:id",
  ...validateRequestWithAuth(protectAdmin, tableIdParamRules),
  getTableById
);

router.patch(
  "/:id/status",
  ...validateRequestWithAuth(protectAdmin, updateTableStatusRules),
  updateTableStatus
);

router.patch(
  "/:id/config",
  ...validateRequestWithAuth(protectAdmin, updateTableConfigRules),
  updateTableConfig
);

router.post(
  "/:id/remove-player",
  ...validateRequestWithAuth(protectAdmin, removePlayerFromTableRules),
  removePlayerFromTable
);

module.exports = router;