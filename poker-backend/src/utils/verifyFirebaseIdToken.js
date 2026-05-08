const {
  FirebaseAdminConfigurationError,
  getFirebaseAdminAuth,
} = require("./firebaseAdmin");

class FirebaseTokenVerificationError extends Error {}

const verifyFirebaseIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== "string") {
    throw new FirebaseTokenVerificationError("Authentication token is required");
  }

  try {
    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);
    const signInProvider = decodedToken.firebase?.sign_in_provider;

    if (signInProvider !== "google.com") {
      throw new FirebaseTokenVerificationError(
        "This token was not issued by Google sign-in"
      );
    }

    if (!decodedToken.email) {
      throw new FirebaseTokenVerificationError(
        "Google account details are incomplete"
      );
    }

    if (decodedToken.email_verified === false) {
      throw new FirebaseTokenVerificationError("Google email is not verified");
    }

    const googleIdentity = decodedToken.firebase?.identities?.["google.com"];
    const googleId =
      Array.isArray(googleIdentity) && googleIdentity[0]
        ? String(googleIdentity[0]).trim()
        : "";
    const normalizedEmail = decodedToken.email.toLowerCase().trim();

    return {
      avatar: decodedToken.picture || "",
      email: normalizedEmail,
      firebaseUid: decodedToken.uid,
      googleId,
      name: decodedToken.name?.trim() || normalizedEmail.split("@")[0],
    };
  } catch (error) {
    if (
      error instanceof FirebaseAdminConfigurationError ||
      error instanceof FirebaseTokenVerificationError
    ) {
      throw error;
    }

    throw new FirebaseTokenVerificationError("Invalid Firebase authentication token");
  }
};

module.exports = {
  FirebaseAdminConfigurationError,
  FirebaseTokenVerificationError,
  verifyFirebaseIdToken,
};
