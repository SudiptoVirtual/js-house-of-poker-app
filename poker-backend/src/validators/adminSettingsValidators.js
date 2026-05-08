const { body } = require("express-validator");

const updateGameSettingsRules = [
  body("defaultGameType")
    .optional()
    .isIn(["7/27", "55 Little Red", "357"])
    .withMessage("Invalid default game type"),

  body("defaultMaxPlayers")
    .optional()
    .isInt({ min: 2, max: 10 })
    .withMessage("defaultMaxPlayers must be between 2 and 10"),

  body("defaultAnte")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("defaultAnte must be 0 or more"),

  body("defaultSmallBlind")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("defaultSmallBlind must be 0 or more"),

  body("defaultBigBlind")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("defaultBigBlind must be 0 or more"),

  body("turnTimerSec")
    .optional()
    .isInt({ min: 5, max: 180 })
    .withMessage("turnTimerSec must be between 5 and 180"),

  body("reconnectGraceSec")
    .optional()
    .isInt({ min: 5, max: 300 })
    .withMessage("reconnectGraceSec must be between 5 and 300"),

  body("allowWildCards")
    .optional()
    .isBoolean()
    .withMessage("allowWildCards must be true or false"),
];

const updateSystemSettingsRules = [
  body("maintenanceMode")
    .optional()
    .isBoolean()
    .withMessage("maintenanceMode must be true or false"),

  body("allowRegistration")
    .optional()
    .isBoolean()
    .withMessage("allowRegistration must be true or false"),

  body("allowDeposits")
    .optional()
    .isBoolean()
    .withMessage("allowDeposits must be true or false"),

  body("allowWithdrawals")
    .optional()
    .isBoolean()
    .withMessage("allowWithdrawals must be true or false"),

  body("supportEmail")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("supportEmail must be a valid email"),

  body("announcement")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("announcement must be at most 500 characters"),
];

module.exports = {
  updateGameSettingsRules,
  updateSystemSettingsRules,
};