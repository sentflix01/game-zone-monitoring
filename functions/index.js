const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

exports.createMonitor = functions.https.onCall(async (data, context) => {
  // Ensure the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated owners can create monitors."
    );
  }

  const ownerId = context.auth.uid;
  const { email, password, displayName } = data;

  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: email, password, or displayName."
    );
  }

  try {
    // 1. Create the Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    const monitorUid = userRecord.uid;

    // 2. Set custom claims (optional, but good for security rules if needed later)
    await auth.setCustomUserClaims(monitorUid, { role: "monitor", ownerId });

    // 3. Create the userIndex document so the monitor knows who their owner is
    await db.collection("userIndex").doc(monitorUid).set({
      ownerId: ownerId,
      role: "monitor",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Register the monitor under the owner's users collection
    await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).set({
      email,
      displayName,
      createdAt: new Date().toISOString(),
      role: "monitor",
    });

    return { success: true, uid: monitorUid };
  } catch (error) {
    console.error("Error creating monitor:", error);
    // Map some common auth errors
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError("already-exists", "The email address is already in use by another account.");
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to create monitor.");
  }
});

exports.deleteMonitor = functions.https.onCall(async (data, context) => {
  // Ensure the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated owners can delete monitors."
    );
  }

  const ownerId = context.auth.uid;
  const { monitorUid } = data;

  if (!monitorUid) {
    throw new functions.https.HttpsError("invalid-argument", "Monitor UID is required.");
  }

  try {
    // 1. Verify this monitor actually belongs to this owner
    const indexDoc = await db.collection("userIndex").doc(monitorUid).get();
    if (!indexDoc.exists || indexDoc.data().ownerId !== ownerId) {
      throw new functions.https.HttpsError("permission-denied", "You do not have permission to delete this monitor.");
    }

    // 2. Delete the user from Firebase Auth
    await auth.deleteUser(monitorUid);

    // 3. Delete the userIndex document
    await db.collection("userIndex").doc(monitorUid).delete();

    // 4. Delete the monitor from the owner's users collection
    await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).delete();

    return { success: true };
  } catch (error) {
    console.error("Error deleting monitor:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to delete monitor.");
  }
});
