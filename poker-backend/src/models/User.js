const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const PLAYER_STATUS_TIERS = [
  "NO_STATUS",
  "LOW_ROLLER",
  "MID_ROLLER",
  "UP_AND_COMING",
  "HIGH_ROLLER",
  "SHARK",
];

const HASH_ROUNDS = 12;

function getLoginLockConfig() {
  const maxAttempts = Math.max(
    1,
    Number.parseInt(process.env.USER_LOGIN_MAX_ATTEMPTS || "5", 10)
  );
  const lockMinutes = Math.max(
    1,
    Number.parseInt(process.env.USER_LOGIN_LOCK_MINUTES || "15", 10)
  );

  return { lockMinutes, maxAttempts };
}

const playerStatusSchema = new mongoose.Schema(
  {
    iconKey: {
      type: String,
      default: "badge-no-status",
      trim: true,
    },
    iconUrl: {
      type: String,
      default: "",
      trim: true,
    },
    label: {
      type: String,
      default: "No Status",
      trim: true,
    },
    lastUpdatedAt: {
      type: Date,
      default: null,
    },
    reputation: {
      type: Number,
      default: 0,
      min: 0,
    },
    tier: {
      type: String,
      enum: PLAYER_STATUS_TIERS,
      default: "NO_STATUS",
    },
  },
  { _id: false }
);

const referralStatsSchema = new mongoose.Schema(
  {
    invitesSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastInviteSentAt: {
      type: Date,
      default: null,
    },
    lastSuccessfulReferralAt: {
      type: Date,
      default: null,
    },
    successfulReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const securitySchema = new mongoose.Schema(
  {
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastFailedLoginAt: {
      type: Date,
      default: null,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required() {
        return !this.firebaseUid && !this.googleId;
      },
      minlength: 8,
    },
    firebaseUid: {
      type: String,
      sparse: true,
      trim: true,
      unique: true,
    },
    googleId: {
      type: String,
      sparse: true,
      trim: true,
      unique: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    chips: {
      type: Number,
      default: 1000,
      min: 0,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "blocked", "suspended"],
      default: "active",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: "",
      trim: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    playerStatus: {
      type: playerStatusSchema,
      default: () => ({}),
    },
    referralCode: {
      type: String,
      default: null,
      sparse: true,
      trim: true,
      unique: true,
      uppercase: true,
    },
    referredByCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    referredByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    referralStats: {
      type: referralStatsSchema,
      default: () => ({}),
    },
    security: {
      type: securitySchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.security) {
    this.security = {};
  }

  if (this.password && this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, HASH_ROUNDS);
    this.security.passwordChangedAt = new Date();
  }

  if (this.isNew && !this.security.passwordChangedAt && this.password) {
    this.security.passwordChangedAt = new Date();
  }

  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.isLoginLocked = function () {
  return Boolean(
    this.security?.lockUntil && new Date(this.security.lockUntil).getTime() > Date.now()
  );
};

userSchema.methods.registerFailedLoginAttempt = async function () {
  const { lockMinutes, maxAttempts } = getLoginLockConfig();
  const now = new Date();

  if (!this.security) {
    this.security = {};
  }

  if (this.security.lockUntil && new Date(this.security.lockUntil).getTime() <= now.getTime()) {
    this.security.failedLoginAttempts = 0;
    this.security.lockUntil = null;
  }

  this.security.failedLoginAttempts = (this.security.failedLoginAttempts || 0) + 1;
  this.security.lastFailedLoginAt = now;

  if (this.security.failedLoginAttempts >= maxAttempts) {
    this.security.lockUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);
  }

  await this.save();

  return {
    failedLoginAttempts: this.security.failedLoginAttempts,
    isLocked: Boolean(this.security.lockUntil),
    lockUntil: this.security.lockUntil,
  };
};

userSchema.methods.resetLoginSecurity = async function () {
  if (!this.security) {
    this.security = {};
  }

  this.security.failedLoginAttempts = 0;
  this.security.lastFailedLoginAt = null;
  this.security.lockUntil = null;
  await this.save();
};

module.exports = mongoose.model("User", userSchema);
