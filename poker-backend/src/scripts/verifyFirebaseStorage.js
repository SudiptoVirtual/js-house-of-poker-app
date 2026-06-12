const crypto = require("crypto");
const { getStorage } = require("firebase-admin/storage");

const { getFirebaseAdminApp } = require("../utils/firebaseAdmin");

async function verifyFirebaseStorage() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();

  if (!bucketName) {
    throw new Error("FIREBASE_STORAGE_BUCKET is required");
  }

  if (bucketName.startsWith("gs://")) {
    throw new Error("FIREBASE_STORAGE_BUCKET must be the bucket name without gs://");
  }

  const bucket = getStorage(getFirebaseAdminApp()).bucket(bucketName);
  const objectName = `deployment-checks/firebase-storage-${crypto.randomUUID()}.txt`;
  const file = bucket.file(objectName);

  try {
    await file.save(Buffer.from("Firebase Storage write check\n"), {
      contentType: "text/plain",
      resumable: false,
    });
    await file.delete();
  } catch (error) {
    throw new Error(
      `Firebase Admin could not create and delete objects in ${bucketName}: ${error.message}`,
      { cause: error }
    );
  }

  console.log(`Firebase Storage write check passed for ${bucketName}`);
}

verifyFirebaseStorage().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
