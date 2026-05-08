const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controllers/adminDashboardController");
const { protectAdmin } = require("../middleware/adminAuth");

router.get("/stats", protectAdmin, getDashboardStats);

module.exports = router;