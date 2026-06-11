// ==========================================================
//  Firebase ID-token verification middleware
//  - requireAuth: blocks if no/invalid token
//  - optionalAuth: attaches user if token present, else guest
// ==========================================================
import { authAdmin, firebaseEnabled } from "../config/firebase.js";
import { fail } from "../utils/apiResponse.js";

async function verify(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !firebaseEnabled || !authAdmin) return null;
  try {
    const decoded = await authAdmin.verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}

export async function optionalAuth(req, res, next) {
  req.user = await verify(req);
  next();
}

export async function requireAuth(req, res, next) {
  const user = await verify(req);
  if (!user) return fail(res, "Authentication required. Please log in.", 401);
  req.user = user;
  next();
}
