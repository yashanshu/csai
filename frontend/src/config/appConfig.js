const parseFirebaseConfig = () => {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
};

const parseBooleanEnv = (value, fallback) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

export const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
export const PUBLIC_API_KEY = import.meta.env.VITE_PUBLIC_API_KEY || "";
export const DEFAULT_PROMPT = "One sentence please.";
export const DEFAULT_MODEL = "llama3";
export const SETTINGS_STORAGE_KEY = "ollama-relay-settings";
export const VIEW_STORAGE_KEY = "ollama-relay-view";
export const MODEL_OPTIONS = ["llama3", "qwen3:8b"];
export const FIREBASE_FIELDS = [
  { key: "apiKey", label: "API Key" },
  { key: "authDomain", label: "Auth Domain" },
  { key: "projectId", label: "Project ID" },
  { key: "storageBucket", label: "Storage Bucket" },
  { key: "messagingSenderId", label: "Messaging Sender ID" },
  { key: "appId", label: "App ID" },
  { key: "measurementId", label: "Measurement ID" },
];
export const REQUIRED_FIREBASE_KEYS = ["apiKey", "authDomain", "projectId", "appId"];
export const DEFAULT_FIREBASE_CONFIG = parseFirebaseConfig();
export const DEFAULT_FIRESTORE_ENABLED = parseBooleanEnv(
  import.meta.env.VITE_FIRESTORE_ENABLED,
  false
);
