import { FIREBASE_FIELDS, REQUIRED_FIREBASE_KEYS } from "../config/appConfig.js";

export const sanitizeFirebaseConfig = (config) => {
  if (!config || typeof config !== "object") {
    return {};
  }
  const cleaned = {};
  for (const field of FIREBASE_FIELDS) {
    const value = config[field.key];
    if (typeof value === "string" && value.trim()) {
      cleaned[field.key] = value.trim();
    }
  }
  return cleaned;
};

export const isFirebaseConfigReady = (config) =>
  REQUIRED_FIREBASE_KEYS.every((key) => config?.[key]);
