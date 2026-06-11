// ==========================================================
//  Optional Cloudinary configuration
// ==========================================================
import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

let cloudinaryEnabled = false;

if (env.cloudinary.enabled && env.cloudinary.cloudName) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
  cloudinaryEnabled = true;
  console.log("✅ Cloudinary enabled.");
}

export { cloudinary, cloudinaryEnabled };
