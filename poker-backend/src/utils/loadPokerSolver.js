const path = require("path");

function loadPokerSolver() {
  try {
    return require("pokersolver");
  } catch (error) {
    const fallbackPath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "js-house-of-poker",
      "node_modules",
      "pokersolver"
    );

    return require(fallbackPath);
  }
}

module.exports = loadPokerSolver();
