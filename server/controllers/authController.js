// ==========================================================
//  Authentication controller
//  Front-end uses Firebase Web SDK for the actual auth flow.
//  These endpoints sync the user profile to Firestore and
//  return the verified profile.
// ==========================================================
import { ok, fail } from "../utils/apiResponse.js";
import { validateRegistration, sanitize } from "../utils/validators.js";
import { upsertUser, getUser } from "../services/firestoreService.js";
import { firebaseEnabled } from "../config/firebase.js";

// POST /api/auth/sync  (requires auth) – store/update profile after sign-up/login
export async function syncProfile(req, res, next) {
  try {
    const uid = req.user.uid;
    const body = {
      username: sanitize(req.body.username) || req.user.name || "",
      email: req.user.email || sanitize(req.body.email) || "",
      gender: sanitize(req.body.gender) || "",
      dateOfBirth: sanitize(req.body.dateOfBirth) || "",
    };

    // Only validate the fields we actually require for a profile sync
    if (body.username && body.username.length < 2)
      return fail(res, "Username must be at least 2 characters.", 422);

    const profile = await upsertUser(uid, body);
    return ok(res, { profile: profile || body }, "Profile synced.");
  } catch (e) {
    next(e);
  }
}

// POST /api/auth/validate-registration – server-side field validation helper
export async function validateRegistrationFields(req, res) {
  const { valid, errors } = validateRegistration(req.body || {});
  if (!valid) return fail(res, "Validation failed.", 422, { errors });
  return ok(res, {}, "Looks good.");
}

// GET /api/auth/me  (requires auth)
export async function me(req, res, next) {
  try {
    const profile = (await getUser(req.user.uid)) || {
      uid: req.user.uid,
      email: req.user.email,
      username: req.user.name || "",
    };
    return ok(res, { profile, firebaseEnabled });
  } catch (e) {
    next(e);
  }
}
