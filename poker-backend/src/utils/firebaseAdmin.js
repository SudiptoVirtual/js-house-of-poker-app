const { cert, getApp, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

class FirebaseAdminConfigurationError extends Error {}

const parseServiceAccountFromEnv = () => {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (rawServiceAccount) {
    try {
      const parsed = JSON.parse(rawServiceAccount);

      return {
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
        projectId: parsed.project_id,
      };
    } catch (error) {
      throw new FirebaseAdminConfigurationError(
        "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON"
      );
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseAdminConfigurationError(
      "Firebase Admin is not configured on the server"
    );
  }

  return {
    clientEmail,
    privateKey,
    projectId,
  };
};

const getFirebaseAdminApp = () => {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccount = parseServiceAccountFromEnv();

  return initializeApp({
    credential: cert({
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
      projectId: serviceAccount.projectId,
    }),
    projectId: serviceAccount.projectId,
  });
};

const getFirebaseAdminAuth = () => {
  return getAuth(getFirebaseAdminApp());
};

module.exports = {
  FirebaseAdminConfigurationError,
  getFirebaseAdminAuth,
};
