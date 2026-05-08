const { param, query } = require("express-validator");

const liveTableListQueryRules = [
  query("status")
    .optional()
    .isIn(["waiting", "active", "paused", "closed"])
    .withMessage("Invalid table status"),

  query("gameType")
    .optional()
    .isIn(["7/27", "55 Little Red", "357"])
    .withMessage("Invalid game type"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search must be at most 100 characters"),
];

const liveTableIdParamRules = [
  param("id")
    .isMongoId()
    .withMessage("Valid live table id is required"),
];

module.exports = {
  liveTableListQueryRules,
  liveTableIdParamRules,
};