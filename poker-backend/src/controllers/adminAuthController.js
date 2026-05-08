const Admin = require("../models/Admin");
const AuditLog = require("../models/AuditLog");
const generateToken = require("../utils/generateToken");

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const admin = await Admin.findOne({ email: normalizedEmail });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        message: "Admin account is inactive",
      });
    }

    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    await AuditLog.create({
      adminId: admin._id,
      action: "ADMIN_LOGIN",
      targetType: "Admin",
      targetId: admin._id.toString(),
      meta: {
        email: admin.email,
        role: admin.role,
      },
    });

    return res.status(200).json({
      message: "Login successful",
      token: generateToken(admin),
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error during admin login",
      error: error.message,
    });
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({
    admin: req.admin,
  });
};

module.exports = {
  loginAdmin,
  getMe,
};