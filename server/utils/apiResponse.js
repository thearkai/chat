// ==========================================================
//  Standardised API response helpers
// ==========================================================
export const ok = (res, data = {}, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

export const fail = (res, message = "Something went wrong", status = 400, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });
