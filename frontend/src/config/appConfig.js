const parseFirebaseConfig = () => {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  let parsed = {};
  if (raw) {
    try {
      const nextParsed = JSON.parse(raw);
      if (nextParsed && typeof nextParsed === "object") {
        parsed = nextParsed;
      }
    } catch {
      parsed = {};
    }
  }

  const envConfig = {};
  const setIf = (key, value) => {
    if (typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    envConfig[key] = trimmed;
  };

  setIf("apiKey", import.meta.env.VITE_FIREBASE_API_KEY);
  setIf("authDomain", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  setIf("projectId", import.meta.env.VITE_FIREBASE_PROJECT_ID);
  setIf("storageBucket", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
  setIf("messagingSenderId", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
  setIf("appId", import.meta.env.VITE_FIREBASE_APP_ID);
  setIf("measurementId", import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);

  const combined = { ...parsed, ...envConfig };
  return Object.keys(combined).length ? combined : {};
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
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "";
export const DEFAULT_PROMPT = "One sentence please.";
export const DEFAULT_MODEL = "Qwen/Qwen3-14B";
export const SETTINGS_STORAGE_KEY = "ollama-relay-settings";
export const VIEW_STORAGE_KEY = "ollama-relay-view";
export const THEME_STORAGE_KEY = "ollama-relay-theme";
export const MODEL_OPTIONS = ["Qwen/Qwen3-14B", "openai/gpt-oss-20b"];
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
