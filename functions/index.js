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
  if (!email) return 'missing_email';
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
  const { email, username, phone, password, displayName } = data;

  if (!password || !displayName) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: password or displayName.");
  }
  if (!email && !username && !phone) {
    throw new functions.https.HttpsError("invalid-argument", "At least one identifier (email, username, or phone) is required.");
  }
  if (password.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  const cleanEmail    = email ? email.trim().toLowerCase() : null;
  const cleanUsername = username ? username.trim().toLowerCase() : null;
  const cleanPhone    = phone ? phone.trim() : null;

  // Firebase Auth requires a unique identifier (usually email). 
  // If no email is provided, generate a deterministic synthetic email based on username/phone
  const authEmail = cleanEmail || `monitor-${cleanUsername || cleanPhone}@synthetic.gamezone.local`;

  // ── 1. Detect whether this email already has a Firebase Auth account ──
  let monitorUid;
  let isExistingOwner = false;

  try {
    const existing = await auth.getUserByEmail(authEmail);
    // Email already registered — this person is an existing owner (or already a monitor)
    monitorUid      = existing.uid;
    isExistingOwner = true;
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      // New user — create a Firebase Auth account
      const userRecord = await auth.createUser({ email: authEmail, password, displayName });
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
      email: cleanEmail || "",
      username: cleanUsername || "",
      phone: cleanPhone || "",
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
        email: cleanEmail || "",
        username: cleanUsername || "",
        phone: cleanPhone || "",
        role: "monitor",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    );
  }

  await batch.commit();

  // ── 4. Update monitorCredentials (searchable by multiple identifiers) ──
  // Store all identifiers for this entry so monitorSignIn can find it.
  const identifiers = [];
  if (cleanEmail) identifiers.push(cleanEmail);
  if (cleanUsername) identifiers.push(cleanUsername);
  if (cleanPhone) identifiers.push(cleanPhone);

  const credRef  = db.collection("monitorCredentials").doc(monitorUid);
  const credSnap = await credRef.get();
  const newEntry = { ownerId, monitorUid, monitorPasswordHash, displayName };

  if (credSnap.exists) {
    const data = credSnap.data();
    // Remove any stale entry for this ownerId then append fresh one
    const existing = (data.entries || []).filter((e) => e.ownerId !== ownerId);
    
    // Merge existing identifiers with new ones
    const allIdentifiers = Array.from(new Set([...(data.identifiers || []), ...identifiers]));

    await credRef.update({ 
      entries: [...existing, newEntry],
      identifiers: allIdentifiers
    });
  } else {
    await credRef.set({ 
      entries: [newEntry],
      identifiers: identifiers
    });
  }

  // For backward compatibility: if there's an email, write to the old emailKey doc too (so older clients don't break immediately)
  if (cleanEmail) {
    const oldCredRef = db.collection("monitorCredentials").doc(emailKey(cleanEmail));
    const oldCredSnap = await oldCredRef.get();
    if (oldCredSnap.exists) {
      const existingOld = (oldCredSnap.data().entries || []).filter((e) => e.ownerId !== ownerId);
      await oldCredRef.update({ entries: [...existingOld, newEntry] });
    } else {
      await oldCredRef.set({ entries: [newEntry] });
    }
  }

  return { success: true, uid: monitorUid, alreadyOwner: isExistingOwner };
});

// ---------------------------------------------------------------------------
// monitorSignIn — verify monitor password, issue custom token
// ---------------------------------------------------------------------------
exports.monitorSignIn = functions.https.onCall(async (data) => {
  const { identifier, password } = data; // generic identifier (email, username, or phone)

  if (!identifier || !password) {
    throw new functions.https.HttpsError("invalid-argument", "Identifier and password are required.");
  }

  const cleanIdentifier = identifier.trim().toLowerCase();

  // 1. Search in new structure: monitorCredentials where identifiers array-contains cleanIdentifier
  const credsSnap = await db.collection("monitorCredentials")
    .where("identifiers", "array-contains", cleanIdentifier)
    .get();

  let entries = [];
  
  if (!credsSnap.empty) {
    // Collect all entries from matching docs
    credsSnap.forEach(doc => {
      entries = entries.concat(doc.data().entries || []);
    });
  } else {
    // 2. Fallback to old structure: monitorCredentials keyed by emailKey
    const oldCredRef = db.collection("monitorCredentials").doc(encodeURIComponent(cleanIdentifier));
    const oldCredSnap = await oldCredRef.get();
    if (oldCredSnap.exists) {
      entries = oldCredSnap.data().entries || [];
    }
  }

  if (entries.length === 0) {
    throw new functions.https.HttpsError("unauthenticated", "Invalid credentials.");
  }

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

  // No match — same error as "not found" to prevent enumeration
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
  const { email, username, phone, displayName } = monitorDoc.data();

  // Look for credentials in new structure
  let credRef = db.collection("monitorCredentials").doc(monitorUid);
  let credSnap = await credRef.get();

  // If not in new structure, try old structure
  if (!credSnap.exists && email) {
    credRef = db.collection("monitorCredentials").doc(emailKey(email));
    credSnap = await credRef.get();
  }

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
  const identUsed = displayName || username || email || phone;
  await db.collection("owners").doc(ownerId).collection("notifications").add({
    type:         "monitor_password_changed",
    message:      `${identUsed} changed their monitor password.`,
    monitorUid,
    monitorEmail: email || "",
    displayName:  identUsed,
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    read:         false,
  });

  return { success: true };
});

// ---------------------------------------------------------------------------
// updateMonitorEmail — monitor changes their own monitor email/identifier
// ---------------------------------------------------------------------------
exports.updateMonitorEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const { currentPassword, newEmail, newUsername, newPhone } = data;

  if (!currentPassword) {
    throw new functions.https.HttpsError("invalid-argument", "currentPassword is required.");
  }

  const monitorUid = context.auth.uid;
  const ownerId    = await resolveMonitorOwnerId(context);

  // Read monitor doc to get old email
  const monitorDoc = await db.collection("owners").doc(ownerId).collection("users").doc(monitorUid).get();
  if (!monitorDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Monitor record not found.");
  }
  const { email: oldEmail } = monitorDoc.data();

  // Verify current password
  let oldCredRef = db.collection("monitorCredentials").doc(monitorUid);
  let oldCredSnap = await oldCredRef.get();
  
  if (!oldCredSnap.exists && oldEmail) {
    oldCredRef = db.collection("monitorCredentials").doc(emailKey(oldEmail));
    oldCredSnap = await oldCredRef.get();
  }

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

  // Update logic: we now prefer the new structure (doc ID = monitorUid).
  // Check if any other user uses these identifiers
  const newIdentifiers = [];
  if (newEmail) newIdentifiers.push(newEmail.trim().toLowerCase());
  if (newUsername) newIdentifiers.push(newUsername.trim().toLowerCase());
  if (newPhone) newIdentifiers.push(newPhone.trim());
  
  for (const ident of newIdentifiers) {
    const conflictSnap = await db.collection("monitorCredentials")
      .where("identifiers", "array-contains", ident)
      .get();
    
    for (const doc of conflictSnap.docs) {
      if (doc.id !== monitorUid) {
        throw new functions.https.HttpsError("already-exists", `The identifier ${ident} is already in use by another account.`);
      }
    }
  }

  const batch = db.batch();

  // Create or update new monitorCredentials doc
  const newCredRef = db.collection("monitorCredentials").doc(monitorUid);
  batch.set(newCredRef, { 
    entries, 
    identifiers: newIdentifiers 
  });

  // If old structure was used, delete it (migration)
  if (oldCredRef.id !== monitorUid) {
    batch.delete(oldCredRef);
  }

  // Update in owners/{ownerId}/users/{monitorUid}
  const updates = {};
  if (newEmail !== undefined) updates.email = newEmail.trim().toLowerCase();
  if (newUsername !== undefined) updates.username = newUsername.trim().toLowerCase();
  if (newPhone !== undefined) updates.phone = newPhone.trim();
  
  batch.update(
    db.collection("owners").doc(ownerId).collection("users").doc(monitorUid),
    updates
  );

  // Update in userIndex (only for non-existing-owner monitors)
  const idxRef = db.collection("userIndex").doc(monitorUid);
  const idxSnap = await idxRef.get();
  if (idxSnap.exists) {
    batch.update(idxRef, updates);
  }

  await batch.commit();

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
  // Check new structure first
  let credRef = db.collection("monitorCredentials").doc(monitorUid);
  let credSnap = await credRef.get();

  // Fallback to old structure
  if (!credSnap.exists && email) {
    credRef = db.collection("monitorCredentials").doc(emailKey(email));
    credSnap = await credRef.get();
  }

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
