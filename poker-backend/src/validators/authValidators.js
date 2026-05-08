const { body } = require("express-validator");

const registerUserRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minNumbers: 1,
      minSymbols: 0,
      minUppercase: 1,
    })
    .withMessage(
      "Password must be at least 8 characters and include uppercase, lowercase, and a number"
    ),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^[+\d()[\]\-\s]{7,20}$/)
    .withMessage("Phone number format is invalid")
    .isLength({ min: 7, max: 20 })
    .withMessage("Phone number must be between 7 and 20 characters"),

  body("referralCode")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 6, max: 16 })
    .withMessage("Referral code must be between 6 and 16 characters"),
];

const loginUserRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

const googleAuthRules = [
  body("idToken")
    .trim()
    .notEmpty()
    .withMessage("Authentication token is required"),
];

const adminLoginRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

module.exports = {
  registerUserRules,
  loginUserRules,
  googleAuthRules,
  adminLoginRules,
};
