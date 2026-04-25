const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db   = admin.firestore();
const auth = admin.auth();

/* ─── createMonitor ─────────────────────────────────────────────────────── */
exports.createMonitor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Only authenticated owners can create monitors.");
  }

  const ownerId = context.auth.uid;
  const { email, password, displayName } = data;

  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: email, password, or displayName.");
  }

  try {
    const userRecord = await auth.createUser({ email, password, displayName });
    const monitorUid = userRecord.uid;

    await auth.setCustomUserClaims(monitorUid, { role: "monitor", ownerId });

    await db.collection("userIndex").doc(monitorUid).set({
      ownerId,
      role: "monitor",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).set({
      email,
      displayName,
      createdAt: new Date().toISOString(),
      role: "monitor",
    });

    return { success: true, uid: monitorUid };
  } catch (error) {
    console.error("Error creating monitor:", error);
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError("already-exists", "The email address is already in use by another account.");
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to create monitor.");
  }
});

/* ─── deleteMonitor ─────────────────────────────────────────────────────── */
exports.deleteMonitor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Only authenticated owners can delete monitors.");
  }

  const ownerId    = context.auth.uid;
  const { monitorUid } = data;

  if (!monitorUid) {
    throw new functions.https.HttpsError("invalid-argument", "Monitor UID is required.");
  }

  try {
    const indexDoc = await db.collection("userIndex").doc(monitorUid).get();
    if (!indexDoc.exists || indexDoc.data().ownerId !== ownerId) {
      throw new functions.https.HttpsError("permission-denied", "You do not have permission to delete this monitor.");
    }

    await auth.deleteUser(monitorUid);
    await db.collection("userIndex").doc(monitorUid).delete();
    await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).delete();

    return { success: true };
  } catch (error) {
    console.error("Error deleting monitor:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to delete monitor.");
  }
});

/* ─── linkedinAuth ──────────────────────────────────────────────────────── */
// Exchanges a LinkedIn OAuth2 authorization code for a Firebase custom token.
// Requires environment variables: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
exports.linkedinAuth = functions.https.onCall(async (data) => {
  const { code, redirectUri } = data;

  if (!code || !redirectUri) {
    throw new functions.https.HttpsError("invalid-argument", "Missing code or redirectUri.");
  }

  const LINKEDIN_CLIENT_ID     = process.env.LINKEDIN_CLIENT_ID;
  const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;

  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "LinkedIn OAuth credentials are not configured on the server."
    );
  }

  // 1. Exchange authorization code for access token
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  redirectUri,
      client_id:     LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("LinkedIn token exchange failed:", errBody);
    throw new functions.https.HttpsError("unauthenticated", "LinkedIn token exchange failed.");
  }

  const { access_token } = await tokenRes.json();

  // 2. Fetch user profile via LinkedIn OIDC userinfo endpoint
  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    throw new functions.https.HttpsError("unauthenticated", "Failed to fetch LinkedIn profile.");
  }

  const profile = await profileRes.json();
  const uid = `linkedin:${profile.sub}`;

  // 3. Create or update Firebase Auth user
  try {
    await auth.updateUser(uid, {
      email:       profile.email      || undefined,
      displayName: profile.name       || undefined,
      photoURL:    profile.picture    || undefined,
    });
  } catch (updateErr) {
    if (updateErr.code === "auth/user-not-found") {
      await auth.createUser({
        uid,
        email:       profile.email      || undefined,
        displayName: profile.name       || undefined,
        photoURL:    profile.picture    || undefined,
      });
    } else {
      throw updateErr;
    }
  }

  // 4. Return Firebase custom token
  const firebaseToken = await auth.createCustomToken(uid);
  return { firebaseToken };
});
