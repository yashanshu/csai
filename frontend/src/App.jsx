import { useEffect, useMemo, useRef, useState } from "react";

import {
  activateAdminKey,
  fetchAdminUsage,
  generateAdminKey,
  generateText,
  listAdminKeys,
  revokeAdminKey,
} from "./api.js";
import AdminView from "./components/admin/AdminView.jsx";
import PublicChatView from "./components/chat/PublicChatView.jsx";
import UserChatView from "./components/chat/UserChatView.jsx";
import AppHeader from "./components/layout/AppHeader.jsx";
import {
  DEFAULT_API_BASE,
  DEFAULT_FIREBASE_CONFIG,
  DEFAULT_FIRESTORE_ENABLED,
  DEFAULT_MODEL,
  DEFAULT_PROMPT,
  MODEL_OPTIONS,
  PUBLIC_API_KEY,
  SETTINGS_STORAGE_KEY,
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
    return parsed;
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

const getRouteMode = () => {
  if (typeof window === "undefined") {
    return "studio";
  }
  const path = window.location.pathname || "/";
  return path.startsWith("/chat") ? "public" : "studio";
};

export default function App() {
  const [routeMode] = useState(getRouteMode);
  const [view, setView] = useState(loadStoredView);
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
      adminSecret: stored?.adminSecret || "",
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

  const chat = useFirestoreChat({
    firebaseConfig: settings.firebaseConfig,
    apiBase: settings.apiBase,
    apiKey: settings.apiKey,
    model: settings.model,
    enabled: settings.firestoreEnabled,
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
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!isPublicRoute) {
      return;
    }
    if (!PUBLIC_API_KEY || settings.apiKey.trim()) {
      return;
    }
    setSettings((prev) => ({ ...prev, apiKey: PUBLIC_API_KEY }));
  }, [isPublicRoute, settings.apiKey]);

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
    settings.apiKey.trim().length > 0 &&
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

  const handleRevokeKey = async () => {
    if (!ensureAdminReady() || isAdminLoading) {
      return;
    }
    const target = adminTargetKey.trim();
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

  const handleActivateKey = async () => {
    if (!ensureAdminReady() || isAdminLoading) {
      return;
    }
    const target = adminTargetKey.trim();
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
  };

  const activeView = isPublicRoute ? "user" : view;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        {isPublicRoute ? null : (
          <AppHeader view={view} onChangeView={setView} />
        )}

        {isPublicRoute ? (
          <PublicChatView chatPanelProps={chatPanelProps} />
        ) : activeView === "user" ? (
          <UserChatView
            settings={settings}
            defaultModel={DEFAULT_MODEL}
            onUpdateSetting={updateSetting}
            onOpenAdmin={() => setView("admin")}
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
            handleGenerate={handleGenerate}
            handleStop={handleStop}
            handleClear={handleClear}
            handleGenerateKey={handleGenerateKey}
            handleActivateKey={handleActivateKey}
            handleRevokeKey={handleRevokeKey}
            handleListKeys={handleListKeys}
            handleFetchUsage={handleFetchUsage}
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
