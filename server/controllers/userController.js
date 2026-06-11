// ==========================================================
//  User controller – profile read/update
// ==========================================================
import { ok, fail } from "../utils/apiResponse.js";
import { sanitize } from "../utils/validators.js";
import { getUser, upsertUser } from "../services/firestoreService.js";

// GET /api/user/profile (requires auth)
export async function getProfile(req, res, next) {
  try {
    const profile =
      (await getUser(req.user.uid)) || { uid: req.user.uid, email: req.user.email };
    return ok(res, { profile });
  } catch (e) {
    next(e);
  }
}

// PUT /api/user/profile (requires auth)
export async function updateProfile(req, res, next) {
  try {
    const updates = {
      username: sanitize(req.body.username),
      gender: sanitize(req.body.gender),
      dateOfBirth: sanitize(req.body.dateOfBirth),
      email: req.user.email,
    };
    if (updates.username && updates.username.length < 2)
      return fail(res, "Username too short.", 422);

    const profile = await upsertUser(req.user.uid, updates);
    return ok(res, { profile: profile || updates }, "Profile updated.");
  } catch (e) {
    next(e);
  }
}
