const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeReferralCode(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function buildNameSeed(name) {
  const normalized = normalizeReferralCode(name).replace(/[0-9]/g, "");
  return normalized.slice(0, 4).padEnd(4, "P");
}

function randomSuffix(length = 4) {
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * REFERRAL_ALPHABET.length);
    return REFERRAL_ALPHABET[index];
  }).join("");
}

async function generateUniqueReferralCode(UserModel, name) {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const candidate = `${buildNameSeed(name)}${randomSuffix(4)}`;
    const existing = await UserModel.exists({ referralCode: candidate });

    if (!existing) {
      return candidate;
    }
  }

  return `${buildNameSeed(name)}${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

module.exports = {
  generateUniqueReferralCode,
  normalizeReferralCode,
};
