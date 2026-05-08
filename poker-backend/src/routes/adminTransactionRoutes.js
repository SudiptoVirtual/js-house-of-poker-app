const express = require("express");
const router = express.Router();

const {
  getTransactions,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} = require("../controllers/adminTransactionController");

const { protectAdmin } = require("../middleware/adminAuth");
const { validateRequestWithAuth } = require("../middleware/validateRequest");

const {
  transactionListQueryRules,
  withdrawalListQueryRules,
  approveWithdrawalRules,
  rejectWithdrawalRules,
} = require("../validators/adminTransactionValidators");

router.get(
  "/",
  ...validateRequestWithAuth(protectAdmin, transactionListQueryRules),
  getTransactions
);

router.get(
  "/withdrawals",
  ...validateRequestWithAuth(protectAdmin, withdrawalListQueryRules),
  getWithdrawals
);

router.patch(
  "/withdrawals/:id/approve",
  ...validateRequestWithAuth(protectAdmin, approveWithdrawalRules),
  approveWithdrawal
);

router.patch(
  "/withdrawals/:id/reject",
  ...validateRequestWithAuth(protectAdmin, rejectWithdrawalRules),
  rejectWithdrawal
);

module.exports = router;