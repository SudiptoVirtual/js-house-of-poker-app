const User = require("../models/User");
const generateUserToken = require("../utils/generateUserToken");
const {
  generateUniqueReferralCode,
  normalizeReferralCode,
} = require("../utils/referrals");
const { serializeUser } = require("../utils/userSerializer");
const {
  FirebaseAdminConfigurationError,
  FirebaseTokenVerificationError,
  verifyFirebaseIdToken,
} = require("../utils/verifyFirebaseIdToken");

const sendAuthResponse = (res, statusCode, message, user) => {
  return res.status(statusCode).json({
    message,
    name: user.name,
    token: generateUserToken(user),
    user: serializeUser(user),
  });
};

const getLockedAccountMessage = (user) => {
  const lockUntil = user.security?.lockUntil;
  if (!lockUntil) {
    return "Too many failed login attempts. Please try again later.";
  }

  return `Too many failed login attempts. Try again after ${new Date(
    lockUntil
  ).toISOString()}.`;
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        message: "Name, email, password and phone are required",
      });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();
    const normalizedReferralCode = normalizeReferralCode(referralCode);

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists with this email",
      });
    }

    let referrer = null;
    if (normalizedReferralCode) {
      referrer = await User.findOne({ referralCode: normalizedReferralCode });

      if (!referrer) {
        return res.status(400).json({
          message: "Referral code is invalid",
        });
      }
    }

    const user = await User.create({
      isOnline: true,
      lastLoginAt: new Date(),
      name: trimmedName,
      email: normalizedEmail,
      password,
      phone: normalizedPhone,
      referralCode: await generateUniqueReferralCode(User, trimmedName),
      referredByCode: referrer?.referralCode || null,
      referredByUserId: referrer?._id || null,
    });

    if (referrer) {
      referrer.referralStats.successfulReferrals += 1;
      referrer.referralStats.lastSuccessfulReferralAt = new Date();
      await referrer.save();
    }

    return sendAuthResponse(res, 201, "Registration successful", user);
  } catch (error) {
    return res.status(500).json({
      message: "Error during registration",
      error: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.isBlocked || user.status === "blocked") {
      return res.status(403).json({
        message: "Your account is blocked",
      });
    }

    if (user.isLoginLocked()) {
      return res.status(423).json({
        message: getLockedAccountMessage(user),
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      const securityState = await user.registerFailedLoginAttempt();
      return res.status(securityState.isLocked ? 423 : 401).json({
        message: securityState.isLocked
          ? getLockedAccountMessage(user)
          : "Invalid email or password",
      });
    }

    user.security.failedLoginAttempts = 0;
    user.security.lastFailedLoginAt = null;
    user.security.lockUntil = null;
    user.lastLoginAt = new Date();
    user.isOnline = true;
    await user.save();

    return sendAuthResponse(res, 200, "Login successful", user);
  } catch (error) {
    return res.status(500).json({
      message: "Error during login",
      error: error.message,
    });
  }
};

const authenticateWithGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;
    const googleProfile = await verifyFirebaseIdToken(idToken);

    let user = await User.findOne({
      $or: [
        { firebaseUid: googleProfile.firebaseUid },
        ...(googleProfile.googleId ? [{ googleId: googleProfile.googleId }] : []),
        { email: googleProfile.email },
      ],
    });

    if (
      user &&
      user.firebaseUid &&
      user.firebaseUid !== googleProfile.firebaseUid
    ) {
      return res.status(409).json({
        message: "A different Firebase account is already linked to this email",
      });
    }

    if (
      user &&
      user.googleId &&
      googleProfile.googleId &&
      user.googleId !== googleProfile.googleId
    ) {
      return res.status(409).json({
        message: "A different Google account is already linked to this email",
      });
    }

    if (user && (user.isBlocked || user.status === "blocked")) {
      return res.status(403).json({
        message: "Your account is blocked",
      });
    }

    if (!user) {
      user = await User.create({
        avatar: googleProfile.avatar,
        email: googleProfile.email,
        firebaseUid: googleProfile.firebaseUid,
        isOnline: true,
        lastLoginAt: new Date(),
        name: googleProfile.name,
        phone: "",
        referralCode: await generateUniqueReferralCode(User, googleProfile.name),
        ...(googleProfile.googleId ? { googleId: googleProfile.googleId } : {}),
      });

      return sendAuthResponse(res, 201, "Google registration successful", user);
    }

    const wasAlreadyLinked = Boolean(user.firebaseUid || user.googleId);

    user.firebaseUid = user.firebaseUid || googleProfile.firebaseUid;
    user.security.failedLoginAttempts = 0;
    user.security.lastFailedLoginAt = null;
    user.security.lockUntil = null;
    user.lastLoginAt = new Date();
    user.isOnline = true;

    if (!user.googleId && googleProfile.googleId) {
      user.googleId = googleProfile.googleId;
    }

    if (!user.avatar && googleProfile.avatar) {
      user.avatar = googleProfile.avatar;
    }

    if (!user.name && googleProfile.name) {
      user.name = googleProfile.name;
    }

    if (!user.referralCode) {
      user.referralCode = await generateUniqueReferralCode(User, user.name);
    }

    await user.save();

    return sendAuthResponse(
      res,
      200,
      wasAlreadyLinked
        ? "Google login successful"
        : "Google account linked and login successful",
      user
    );
  } catch (error) {
    if (error instanceof FirebaseAdminConfigurationError) {
      return res.status(500).json({
        message: error.message,
      });
    }

    if (error instanceof FirebaseTokenVerificationError) {
      return res.status(401).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Error during Google authentication",
      error: error.message,
    });
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({
    user: serializeUser(req.user),
  });
};

const logoutUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
    });

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error during logout",
      error: error.message,
    });
  }
};

module.exports = {
  authenticateWithGoogle,
  registerUser,
  loginUser,
  getMe,
  logoutUser,
};
