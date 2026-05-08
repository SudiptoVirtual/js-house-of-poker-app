const jwt = require("jsonwebtoken");

const generateUserToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: "player",
      type: "user",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

module.exports = generateUserToken;