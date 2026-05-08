const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await Admin.findOne({ email: "admin@pokerapp.com" });

    if (existing) {
      console.log("Admin already exists");
      process.exit(0);
    }

    await Admin.create({
      name: "Super Admin",
      email: "admin@pokerapp.com",
      password: "Admin123!",
      role: "super_admin",
    });

    console.log("Admin created successfully");
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

seedAdmin();