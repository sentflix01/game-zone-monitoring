const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const bcrypt    = require("bcryptjs");

admin.initializeApp();

const db   = admin.firestore();
const auth = admin.auth();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safe Firestore document key from an email address */
function emailKey(email) {
  return encodeURIComponent(email.toLowerCase().trim());
}

/** Resolve the ownerId for the calling monitor from userIndex or token claims */
async function resolveMonitorOwnerId(context) {
  // Custom-token sign-ins carry ownerId in claims
  if (context.auth.token && context.auth.token.ownerId) {
    return context.auth.token.ownerId;
  }
  // Regular monitors have a userIndex entry
  const idx = await db.collection("userIndex").doc(context.auth.uid).get();
  if (idx.exists) return idx.data().ownerId;
  throw new functions.https.HttpsError("not-found", "Monitor record not found.");
}

// ---------------------------------------------------------------------------
// createMonitor — owner creates a monitor account
// ---------------------------------------------------------------------------
exports.createMonitor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Only authenticated owners can create monitors.");
  }

  const ownerId = context.auth.uid;
  const { email, password, displayName } = data;

  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: email, password, or displayName.");
  }
  if (password.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  // ── 1. Detect whether this email already has a Firebase Auth account ──
  let monitorUid;
  let isExistingOwner = false;

  try {
    const existing = await auth.getUserByEmail(email);
    // Email already registered — this person is an existing owner
    monitorUid      = existing.uid;
    isExistingOwner = true;
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      // New user — create a Firebase Auth account
      const userRecord = await auth.createUser({ email, password, displayName });
      monitorUid       = userRecord.uid;
      isExistingOwner  = false;
    } else {
      throw new functions.https.HttpsError("internal", err.message || "Failed to look up user.");
    }
  }

  // ── 2. Hash the monitor password ──
  const monitorPasswordHash = await bcrypt.hash(password, 10);

  // ── 3. Write Firestore documents ──
  const batch = db.batch();

  // owners/{ownerId}/users/{monitorUid}
  batch.set(
    db.collection("owners").doc(ownerId).collection("users").doc(monitorUid),
    {
      email,
      displayName,
      isExistingOwner,
      monitorPasswordHash,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }
  );

  // userIndex — only for NEW users (existing owners already have their own identity)
  if (!isExistingOwner) {
    batch.set(
      db.collection("userIndex").doc(monitorUid),
      {
        ownerId,
        email,
        role: "monitor",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    );
  }

  await batch.commit();

  // ── 4. Update monitorCredentials (array union, outside batch for read-modify-write) ──
  const credRef  = db.collection("monitorCredentials").doc(emailKey(email));
  const credSnap = await credRef.get();
  const newEntry = { ownerId, monitorUid, monitorPasswordHash, displayName };

  if (credSnap.exists) {
    // Remove any stale entry for this ownerId then append fresh one
    const existing = (credSnap.data().entries || []).filter((e) => e.ownerId !== ownerId);
    await credRef.update({ entries: [...existing, newEntry] });
  } else {
    await credRef.set({ entries: [newEntry] });
  }

  return { success: true, uid: monitorUid, alreadyOwner: isExistingOwner };
});

// ---------------------------------------------------------------------------
// monitorSignIn — verify monitor password, issue custom token
// ---------------------------------------------------------------------------
exports.monitorSignIn = functions.https.onCall(async (data) => {
  const { email, password } = data;

  if (!email || !password) {
    throw new functions.https.HttpsError("invalid-argument", "Email and password are required.");
  }

  const credRef  = db.collection("monitorCredentials").doc(emailKey(email));
  const credSnap = await credRef.get();

  if (!credSnap.exists) {
    throw new functions.https.HttpsError("unauthenticated", "Invalid credentials.");
  }

  const entries = credSnap.data().entries || [];

  for (const entry of entries) {
    const match = await bcrypt.compare(password, entry.monitorPasswordHash);
    if (match) {
      // Issue a custom token with monitor role + ownerId claims
      const token = await auth.createCustomToken(entry.monitorUid, {
        role:    "monitor",
        ownerId: entry.ownerId,
      });
      return { token };
    }
  }

  // No match — same error as "not found" to prevent email enumeration
  throw new functions.https.HttpsError("unauthenticated", "Invalid credentials.");
});

// ---------------------------------------------------------------------------
// updateMonitorPassword — monitor changes their own monitor password
// ---------------------------------------------------------------------------
exports.updateMonitorPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const { currentPassword, newPassword } = data;

  if (!currentPassword || !newPassword) {
    throw new functions.https.HttpsError("invalid-argument", "currentPassword and newPassword are required.");
  }
  if (newPassword.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "New password must be at least 6 characters.");
  }

  const monitorUid = context.auth.uid;
  const ownerId    = await resolveMonitorOwnerId(context);

  // Read monitor doc to get email
  const monitorDoc = await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).get();
  if (!monitorDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Monitor record not found.");
  }
  const { email, displayName } = monitorDoc.data();

  // Verify current password
  const credRef  = db.collection("monitorCredentials").doc(emailKey(email));
  const credSnap = await credRef.get();
  if (!credSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Monitor credentials not found.");
  }

  const entries = credSnap.data().entries || [];
  const entryIdx = entries.findIndex((e) => e.monitorUid === monitorUid);
  if (entryIdx === -1) {
    throw new functions.https.HttpsError("not-found", "Monitor entry not found.");
  }

  const valid = await bcrypt.compare(currentPassword, entries[entryIdx].monitorPasswordHash);
  if (!valid) {
    throw new functions.https.HttpsError("unauthenticated", "Current password is incorrect.");
  }

  // Hash new password
  const newHash = await bcrypt.hash(newPassword, 10);

  // Update ALL entries for this monitorUid (multi-owner case)
  const updatedEntries = entries.map((e) =>
    e.monitorUid === monitorUid ? { ...e, monitorPasswordHash: newHash } : e
  );
  await credRef.update({ entries: updatedEntries });

  // Update owner's users subcollection
  await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).update({
    monitorPasswordHash: newHash,
  });

  // Write notification to owner
  await db.collection("owners").doc(ownerId).collection("notifications").add({
    type:         "monitor_password_changed",
    message:      `${displayName || email} changed their monitor password.`,
    monitorUid,
    monitorEmail: email,
    displayName:  displayName || email,
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    read:         false,
  });

  return { success: true };
});

// ---------------------------------------------------------------------------
// updateMonitorEmail — monitor changes their own monitor email
// ---------------------------------------------------------------------------
exports.updateMonitorEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const { currentPassword, newEmail } = data;

  if (!currentPassword || !newEmail) {
    throw new functions.https.HttpsError("invalid-argument", "currentPassword and newEmail are required.");
  }

  const monitorUid = context.auth.uid;
  const ownerId    = await resolveMonitorOwnerId(context);

  // Read monitor doc to get old email
  const monitorDoc = await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).get();
  if (!monitorDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Monitor record not found.");
  }
  const { email: oldEmail, displayName } = monitorDoc.data();

  // Verify current password
  const oldCredRef  = db.collection("monitorCredentials").doc(emailKey(oldEmail));
  const oldCredSnap = await oldCredRef.get();
  if (!oldCredSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Monitor credentials not found.");
  }

  const entries  = oldCredSnap.data().entries || [];
  const entry    = entries.find((e) => e.monitorUid === monitorUid);
  if (!entry) {
    throw new functions.https.HttpsError("not-found", "Monitor entry not found.");
  }

  const valid = await bcrypt.compare(currentPassword, entry.monitorPasswordHash);
  if (!valid) {
    throw new functions.https.HttpsError("unauthenticated", "Current password is incorrect.");
  }

  // Check new email not already in use as monitor credentials
  const newCredRef  = db.collection("monitorCredentials").doc(emailKey(newEmail));
  const newCredSnap = await newCredRef.get();
  if (newCredSnap.exists) {
    throw new functions.https.HttpsError("already-exists", "That email is already in use as monitor credentials.");
  }

  // Atomic batch: migrate monitorCredentials key + update all docs
  const updatedEntries = entries.map((e) =>
    e.monitorUid === monitorUid ? { ...e } : e
  );

  const batch = db.batch();

  // Create new monitorCredentials doc
  batch.set(newCredRef, { entries: updatedEntries });

  // Delete old monitorCredentials doc
  batch.delete(oldCredRef);

  // Update email in owners/{ownerId}/users/{monitorUid}
  batch.update(
    db.collection("owners").doc(ownerId).collection("users").doc(monitorUid),
    { email: newEmail }
  );

  // Update email in userIndex (only for non-existing-owner monitors)
  const idxRef = db.collection("userIndex").doc(monitorUid);
  const idxSnap = await idxRef.get();
  if (idxSnap.exists) {
    batch.update(idxRef, { email: newEmail });
  }

  await batch.commit();

  // Write notification to each owner this monitor is registered under
  const notifPromises = updatedEntries.map((e) =>
    db.collection("owners").doc(e.ownerId).collection("notifications").add({
      type:         "monitor_email_changed",
      message:      `${displayName || oldEmail} changed their monitor email from ${oldEmail} to ${newEmail}.`,
      monitorUid,
      monitorEmail: newEmail,
      oldEmail,
      newEmail,
      displayName:  displayName || oldEmail,
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      read:         false,
    })
  );
  await Promise.all(notifPromises);

  return { success: true };
});

// ---------------------------------------------------------------------------
// deleteMonitor — owner removes a monitor
// ---------------------------------------------------------------------------
exports.deleteMonitor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Only authenticated owners can delete monitors.");
  }

  const ownerId        = context.auth.uid;
  const { monitorUid } = data;

  if (!monitorUid) {
    throw new functions.https.HttpsError("invalid-argument", "Monitor UID is required.");
  }

  // Verify ownership
  const monitorDoc = await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).get();
  if (!monitorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "You do not have permission to delete this monitor.");
  }

  const { email, isExistingOwner } = monitorDoc.data();

  // ── 1. Update monitorCredentials — remove this owner's entry ──
  const credRef  = db.collection("monitorCredentials").doc(emailKey(email));
  const credSnap = await credRef.get();

  if (credSnap.exists) {
    const remaining = (credSnap.data().entries || []).filter((e) => e.ownerId !== ownerId);
    if (remaining.length === 0) {
      await credRef.delete();
    } else {
      await credRef.update({ entries: remaining });
    }
  }

  // ── 2. Delete owner's users subcollection entry ──
  await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).delete();

  // ── 3. For non-existing-owner monitors: delete userIndex + Firebase Auth user ──
  if (!isExistingOwner) {
    await db.collection("userIndex").doc(monitorUid).delete();
    try {
      await auth.deleteUser(monitorUid);
    } catch (err) {
      // User may have already been deleted — not fatal
      console.warn("deleteMonitor: could not delete Auth user:", err.message);
    }
  }

  return { success: true };
});
