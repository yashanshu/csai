import { useEffect, useMemo, useRef, useState } from "react";

import {
  activateAdminKey,
  fetchHealth,
  fetchAdminUsage,
  generateAdminKey,
  generateText,
  listAdminKeys,
  revokeAdminKey,
  updateAdminKey,
} from "./api.js";
import AdminView from "./components/admin/AdminView.jsx";
import PublicChatView from "./components/chat/PublicChatView.jsx";
import UserChatView from "./components/chat/UserChatView.jsx";
import AppHeader from "./components/layout/AppHeader.jsx";
import PasswordGate from "./components/layout/PasswordGate.jsx";
import {
  ADMIN_PASSWORD,
  DEFAULT_API_BASE,
  DEFAULT_FIREBASE_CONFIG,
  DEFAULT_FIRESTORE_ENABLED,
  DEFAULT_MODEL,
  DEFAULT_PROMPT,
  MODEL_OPTIONS,
  PUBLIC_API_KEY,
  QWEN_SERVICE_URL,
  SETTINGS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  VIEW_STORAGE_KEY,
} from "./config/appConfig.js";
import { useFirestoreChat } from "./hooks/useFirestoreChat.js";
import { normalizeModelName } from "./lib/modelUtils.js";

const loadStoredSettings = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const { adminSecret: _ignored, ...rest } = parsed;
    return rest;
  } catch {
    return null;
  }
};

const loadStoredView = () => {
  if (typeof window === "undefined") {
    return "user";
  }
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return stored === "admin" ? "admin" : "user";
};

const ADMIN_UNLOCK_STORAGE_KEY = "ollama-relay-admin-unlocked";

const loadStoredAdminUnlock = () => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(ADMIN_UNLOCK_STORAGE_KEY) === "true";
};

const getRouteMode = () => {
  if (typeof window === "undefined") {
    return "studio";
  }
  const path = window.location.pathname || "/";
  return path.startsWith("/chat") ? "public" : "studio";
};

const loadStoredTheme = () => {
  if (typeof window === "undefined") {
    return "relay";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "relay-dark" ? "relay-dark" : "relay";
};

export default function App() {
  const [routeMode] = useState(getRouteMode);
  const [view, setView] = useState(loadStoredView);
  const [theme, setTheme] = useState(loadStoredTheme);
  const [adminSection, setAdminSection] = useState("overview");
  const [chatSidebarCollapsed, setChatSidebarCollapsed] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const hasAdminPassword = ADMIN_PASSWORD.trim().length > 0;
  const [adminUnlocked, setAdminUnlocked] = useState(() =>
    hasAdminPassword ? loadStoredAdminUnlock() : true
  );
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminGateError, setAdminGateError] = useState("");
  const [settings, setSettings] = useState(() => {
    const stored = loadStoredSettings();
    const storedFirebase =
      stored?.firebaseConfig && typeof stored.firebaseConfig === "object"
        ? stored.firebaseConfig
        : {};
    const inferredFirestoreEnabled =
      typeof stored?.firestoreEnabled === "boolean"
        ? stored.firestoreEnabled
        : DEFAULT_FIRESTORE_ENABLED;
    return {
      apiBase: stored?.apiBase || DEFAULT_API_BASE,
      apiKey: stored?.apiKey || "",
      adminSecret: "",
      model: normalizeModelName(stored?.model || DEFAULT_MODEL),
      stream: typeof stored?.stream === "boolean" ? stored.stream : false,
      firestoreEnabled: inferredFirestoreEnabled,
      firebaseConfig: { ...DEFAULT_FIREBASE_CONFIG, ...storedFirebase },
    };
  });
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState("Idle");
  const [adminError, setAdminError] = useState("");
  const [adminRequestId, setAdminRequestId] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [adminTargetKey, setAdminTargetKey] = useState("");
  const [adminKeys, setAdminKeys] = useState([]);
  const [adminUsage, setAdminUsage] = useState(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [keysLimit, setKeysLimit] = useState(100);
  const [adminHealth, setAdminHealth] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMode, setChatMode] = useState("text");
  const [imageOptions, setImageOptions] = useState({
    width: 768,
    height: 768,
    steps: 30,
    guidance: 7,
    negativePrompt: "",
  });

  const abortRef = useRef(null);
  const isPublicRoute = routeMode === "public";
  const publicSettings = {
    apiBase: DEFAULT_API_BASE,
    apiKey: PUBLIC_API_KEY,
    firebaseConfig: DEFAULT_FIREBASE_CONFIG,
    firestoreEnabled: DEFAULT_FIRESTORE_ENABLED,
  };
  const activeSettings = isPublicRoute
    ? { ...settings, ...publicSettings }
    : settings;

  const chat = useFirestoreChat({
    firebaseConfig: activeSettings.firebaseConfig,
    apiBase: activeSettings.apiBase,
    apiKey: activeSettings.apiKey,
    adminSecret: isPublicRoute ? "" : settings.adminSecret,
    model: activeSettings.model,
    enabled: activeSettings.firestoreEnabled,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const { adminSecret: _ignored, ...persisted } = settings;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(persisted));
  }, [settings]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(
      ADMIN_UNLOCK_STORAGE_KEY,
      adminUnlocked ? "true" : "false"
    );
  }, [adminUnlocked]);

  useEffect(() => {
    if (isPublicRoute || !hasAdminPassword) {
      return;
    }
    if (adminUnlocked && settings.adminSecret !== ADMIN_PASSWORD) {
      setSettings((prev) => ({ ...prev, adminSecret: ADMIN_PASSWORD }));
      return;
    }
    if (!adminUnlocked && settings.adminSecret) {
      setSettings((prev) => ({ ...prev, adminSecret: "" }));
    }
  }, [
    adminUnlocked,
    hasAdminPassword,
    isPublicRoute,
    settings.adminSecret,
  ]);

  const payloadPreview = useMemo(
    () =>
      JSON.stringify(
        {
          model: settings.model,
          prompt,
          stream: settings.stream,
        },
        null,
        2,
      ),
    [settings.model, prompt, settings.stream],
  );

  const firebasePreview = useMemo(
    () => JSON.stringify(settings.firebaseConfig, null, 2),
    [settings.firebaseConfig],
  );

  const canSubmit =
    settings.apiKey.trim().length > 0 && prompt.trim().length > 0;
  const canChat =
    activeSettings.apiKey.trim().length > 0 &&
    chatInput.trim().length > 0 &&
    Boolean(chat.firestoreDb);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateFirebase = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      firebaseConfig: { ...prev.firebaseConfig, [key]: value },
    }));
  };

  const handleGenerate = async () => {
    if (!canSubmit || isLoading) {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setOutput("");
    setError("");
    setRequestId("");
    setStatus(settings.stream ? "Streaming..." : "Generating...");

    try {
      const result = await generateText({
        baseUrl: settings.apiBase,
        apiKey: settings.apiKey,
        adminSecret: settings.adminSecret,
        model: settings.model,
        prompt,
        stream: settings.stream,
        signal: controller.signal,
        onChunk: (chunk) => {
          setOutput((prev) => prev + chunk);
        },
      });
      setRequestId(result.requestId || "");
      if (!settings.stream) {
        setOutput(result.text || "");
      }
      setStatus("Done");
    } catch (err) {
      if (err?.name === "AbortError") {
        setStatus("Stopped");
        return;
      }
      setStatus("Error");
      setError(err?.message || "Request failed.");
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  const handleClear = () => {
    setOutput("");
    setError("");
    setStatus("Idle");
    setRequestId("");
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "relay-dark" ? "relay" : "relay-dark"));
  };

  const handleAdminPasswordChange = (value) => {
    setAdminPasswordInput(value);
    if (adminGateError) {
      setAdminGateError("");
    }
  };

  const handleUnlockAdmin = () => {
    if (!hasAdminPassword) {
      setAdminUnlocked(true);
      setAdminGateError("");
      return;
    }
    if (!adminPasswordInput.trim()) {
      setAdminGateError("Password is required.");
      return;
    }
    if (adminPasswordInput.trim() !== ADMIN_PASSWORD) {
      setAdminGateError("Incorrect password.");
      return;
    }
    setAdminUnlocked(true);
    setAdminPasswordInput("");
    setAdminGateError("");
  };

  const ensureAdminReady = () => {
    if (!settings.adminSecret.trim()) {
      setAdminError("Admin secret is required.");
      setAdminStatus("Error");
      return false;
    }
    return true;
  };

  const handleGenerateKey = async () => {
    if (!ensureAdminReady() || isAdminLoading) {
      return;
    }
    setIsAdminLoading(true);
    setAdminStatus("Generating...");
    setAdminError("");
    setAdminRequestId("");
    setGeneratedKey("");
    try {
      const { data, requestId: nextRequestId } = await generateAdminKey({
        baseUrl: settings.apiBase,
        adminSecret: settings.adminSecret,
      });
      setGeneratedKey(data?.api_key || "");
      setAdminRequestId(nextRequestId || "");
      setAdminStatus("Done");
    } catch (err) {
      setAdminStatus("Error");
      setAdminError(err?.message || "Failed to generate key.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleRevokeKey = async (overrideKey) => {
    if (!ensureAdminReady() || isAdminLoading) {
      return;
    }
    const target = (overrideKey || adminTargetKey).trim();
    if (!target) {
      setAdminError("Provide an API key to revoke.");
      setAdminStatus("Error");
      return;
    }
    setIsAdminLoading(true);
    setAdminStatus("Revoking...");
    setAdminError("");
    setAdminRequestId("");
    try {
      const { requestId: nextRequestId } = await revokeAdminKey({
        baseUrl: settings.apiBase,
        adminSecret: settings.adminSecret,
        apiKey: target,
      });
      setAdminRequestId(nextRequestId || "");
      setAdminStatus("Done");
    } catch (err) {
      setAdminStatus("Error");
      setAdminError(err?.message || "Failed to revoke key.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleActivateKey = async (overrideKey) => {
    if (!ensureAdminReady() || isAdminLoading) {
      return;
    }
    const target = (overrideKey || adminTargetKey).trim();
    if (!target) {
      setAdminError("Provide an API key to activate.");
      setAdminStatus("Error");
      return;
    }
    setIsAdminLoading(true);
    setAdminStatus("Activating...");
    setAdminError("");
    setAdminRequestId("");
    try {
      const { requestId: nextRequestId } = await activateAdminKey({
        baseUrl: settings.apiBase,
        adminSecret: settings.adminSecret,
        apiKey: target,
      });
      setAdminRequestId(nextRequestId || "");
      setAdminStatus("Done");
    } catch (err) {
      setAdminStatus("Error");
      setAdminError(err?.message || "Failed to activate key.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleListKeys = async () => {
    if (!ensureAdminReady() || isAdminLoading) {
      return;
    }
    setIsAdminLoading(true);
    setAdminStatus("Loading keys...");
    setAdminError("");
    setAdminRequestId("");
    try {
      const { data, requestId: nextRequestId } = await listAdminKeys({
        baseUrl: settings.apiBase,
        adminSecret: settings.adminSecret,
        limit: Number(keysLimit) || 100,
      });
      setAdminKeys(Array.isArray(data?.keys) ? data.keys : []);
      setAdminRequestId(nextRequestId || "");
      setAdminStatus("Done");
    } catch (err) {
      setAdminStatus("Error");
      setAdminError(err?.message || "Failed to list keys.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleFetchUsage = async () => {
    if (!ensureAdminReady() || isAdminLoading) {
      return;
    }
    setIsAdminLoading(true);
    setAdminStatus("Loading usage...");
    setAdminError("");
    setAdminRequestId("");
    try {
      const { data, requestId: nextRequestId } = await fetchAdminUsage({
        baseUrl: settings.apiBase,
        adminSecret: settings.adminSecret,
        apiKey: adminTargetKey.trim() || undefined,
        limit: Number(keysLimit) || 100,
      });
      setAdminUsage(data || null);
      setAdminRequestId(nextRequestId || "");
      setAdminStatus("Done");
    } catch (err) {
      setAdminStatus("Error");
      setAdminError(err?.message || "Failed to fetch usage.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleUpdateKey = async (apiKey, updates) => {
    if (!ensureAdminReady() || isAdminLoading) {
      return;
    }
    const target = apiKey?.trim();
    if (!target) {
      setAdminError("Provide an API key to update.");
      setAdminStatus("Error");
      return null;
    }
    setIsAdminLoading(true);
    setAdminStatus("Updating key...");
    setAdminError("");
    setAdminRequestId("");
    try {
      const { data, requestId: nextRequestId } = await updateAdminKey({
        baseUrl: settings.apiBase,
        adminSecret: settings.adminSecret,
        apiKey: target,
        updates,
      });
      setAdminRequestId(nextRequestId || "");
      setAdminStatus("Done");
      return data;
    } catch (err) {
      setAdminStatus("Error");
      setAdminError(err?.message || "Failed to update key.");
      return null;
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleFetchHealth = async () => {
    setIsAdminLoading(true);
    setAdminStatus("Loading health...");
    setAdminError("");
    setAdminRequestId("");
    try {
      const { data, requestId: nextRequestId } = await fetchHealth({
        baseUrl: settings.apiBase,
      });
      setAdminHealth(data || null);
      setAdminRequestId(nextRequestId || "");
      setAdminStatus("Done");
    } catch (err) {
      setAdminStatus("Error");
      setAdminError(err?.message || "Failed to fetch health.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleSendChat = () => {
    if (!canChat || chat.isChatLoading) {
      return;
    }
    const trimmed = chatInput.trim();
    if (!trimmed) {
      return;
    }
    setChatInput("");
    if (chatMode === "image") {
      chat.sendImage({ prompt: trimmed, options: imageOptions });
    } else {
      chat.sendMessage(trimmed);
    }
  };

  const handleStartNewChat = () => {
    setChatInput("");
    chat.startNewChat();
  };

  const handleSelectChat = (chatId) => {
    chat.selectChat(chatId);
  };

  const handleImageOptionsChange = (updates) => {
    setImageOptions((prev) => ({ ...prev, ...updates }));
  };

  const statusTone = (() => {
    if (status === "Error") return "badge-error";
    if (status === "Done") return "badge-success";
    if (status === "Stopped") return "badge-warning";
    if (status === "Streaming..." || status === "Generating...")
      return "badge-info";
    return "badge-ghost";
  })();

  const chatTone = (() => {
    if (chat.chatStatus === "Error") return "badge-error";
    if (chat.chatStatus === "Done") return "badge-success";
    if (chat.chatStatus === "Thinking...") return "badge-info";
    return "badge-ghost";
  })();

  const adminTone = (() => {
    if (adminStatus === "Error") return "badge-error";
    if (adminStatus === "Done") return "badge-success";
    if (adminStatus.includes("Loading") || adminStatus.endsWith("..."))
      return "badge-info";
    return "badge-ghost";
  })();

  const firestoreTone = (() => {
    if (chat.firestoreStatus === "Error") return "badge-error";
    if (chat.firestoreStatus === "Connected") return "badge-success";
    if (chat.firestoreStatus === "Connecting...") return "badge-info";
    if (chat.firestoreStatus === "Disabled") return "badge-ghost";
    if (chat.firestoreStatus === "Missing config") return "badge-warning";
    return "badge-ghost";
  })();

  const chatEmptyState = !chat.firestoreDb
    ? chat.firestoreStatus === "Disabled"
      ? "Enable Firestore sync to use chat history."
      : "Connect Firebase to sync chat history."
    : chat.activeChatId
      ? "No messages yet. Send your first prompt."
      : "Select a conversation or start a new chat.";

  const chatSidebarProps = {
    firestoreStatus: chat.firestoreStatus,
    firestoreTone,
    firestoreError: chat.firestoreError,
    chatThreads: chat.chatThreads,
    activeChatId: chat.activeChatId,
    onSelectChat: handleSelectChat,
    onStartNewChat: handleStartNewChat,
    hasFirestore: Boolean(chat.firestoreDb),
    collapsed: chatSidebarCollapsed,
    onToggleCollapse: () => setChatSidebarCollapsed((prev) => !prev),
    searchTerm: chatSearch,
    onSearchTermChange: setChatSearch,
    apiKey: settings.apiKey,
    apiBase: settings.apiBase,
    model: settings.model,
    onUpdateSetting: updateSetting,
    isPublicRoute,
  };

  const chatPanelProps = {
    activeChat: chat.activeChat,
    chatStatus: chat.chatStatus,
    chatTone,
    chatMessages: chat.chatMessages,
    chatEmptyState,
    chatError: chat.chatError,
    chatInput,
    onChatInputChange: setChatInput,
    onSendChat: handleSendChat,
    onStartNewChat: handleStartNewChat,
    isChatLoading: chat.isChatLoading,
    canChat,
    chatRequestId: chat.chatRequestId,
    hasFirestore: Boolean(chat.firestoreDb),
    inputMode: chatMode,
    onInputModeChange: setChatMode,
    imageOptions,
    onImageOptionsChange: handleImageOptionsChange,
    model: settings.model,
    onModelChange: (value) => updateSetting("model", value),
    onToggleSidebar: () => setChatSidebarCollapsed((prev) => !prev),
    sidebarCollapsed: chatSidebarCollapsed,
  };

  const activeView = isPublicRoute ? "user" : view;

  if (!isPublicRoute && hasAdminPassword && !adminUnlocked) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
          <PasswordGate
            title="Private console"
            subtitle="Enter the admin password to access the studio."
            password={adminPasswordInput}
            onPasswordChange={handleAdminPasswordChange}
            onSubmit={handleUnlockAdmin}
            error={adminGateError}
            hasPassword={hasAdminPassword}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <AppHeader
        view={activeView}
        onChangeView={setView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isPublic={isPublicRoute}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-10 pt-6 md:px-6">
        {isPublicRoute ? (
          <PublicChatView
            chatPanelProps={chatPanelProps}
            chatSidebarProps={chatSidebarProps}
          />
        ) : activeView === "user" ? (
          <UserChatView
            chatSidebarProps={chatSidebarProps}
            chatPanelProps={chatPanelProps}
          />
        ) : (
          <AdminView
            settings={settings}
            updateSetting={updateSetting}
            updateFirebase={updateFirebase}
            firebasePreview={firebasePreview}
            prompt={prompt}
            setPrompt={setPrompt}
            payloadPreview={payloadPreview}
            canSubmit={canSubmit}
            isLoading={isLoading}
            status={status}
            statusTone={statusTone}
            requestId={requestId}
            error={error}
            output={output}
            defaultModel={DEFAULT_MODEL}
            adminSecretLocked={hasAdminPassword}
            adminStatus={adminStatus}
            adminTone={adminTone}
            adminError={adminError}
            adminRequestId={adminRequestId}
            adminTargetKey={adminTargetKey}
            setAdminTargetKey={setAdminTargetKey}
            keysLimit={keysLimit}
            setKeysLimit={setKeysLimit}
            isAdminLoading={isAdminLoading}
            generatedKey={generatedKey}
            adminKeys={adminKeys}
            adminUsage={adminUsage}
            adminHealth={adminHealth}
            adminSection={adminSection}
            setAdminSection={setAdminSection}
            qwenServiceUrl={QWEN_SERVICE_URL}
            handleGenerate={handleGenerate}
            handleStop={handleStop}
            handleClear={handleClear}
            handleGenerateKey={handleGenerateKey}
            handleActivateKey={handleActivateKey}
            handleRevokeKey={handleRevokeKey}
            handleListKeys={handleListKeys}
            handleFetchUsage={handleFetchUsage}
            handleUpdateKey={handleUpdateKey}
            handleFetchHealth={handleFetchHealth}
          />
        )}
      </div>
      <datalist id="model-options">
        {MODEL_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}
