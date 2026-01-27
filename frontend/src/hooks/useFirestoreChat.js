import { useEffect, useMemo, useRef, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { generateImage, sendChat } from "../api.js";
import { createChatTitle, truncateText } from "../lib/chatUtils.js";
import {
  isFirebaseConfigReady,
  sanitizeFirebaseConfig,
} from "../lib/firebaseConfig.js";

const FIRESTORE_MISSING_MESSAGE =
  "Firestore database not found. Create a Firestore database for this project in the Firebase console.";

const isFirestoreDatabaseMissing = (err) => {
  const message = err?.message || "";
  return (
    err?.code === "not-found" ||
    /database \(default\) does not exist/i.test(message)
  );
};

export const useFirestoreChat = ({
  firebaseConfig,
  apiBase,
  apiKey,
  adminSecret,
  model,
  enabled = true,
}) => {
  const [firestoreDb, setFirestoreDb] = useState(null);
  const [firestoreStatus, setFirestoreStatus] = useState("Missing config");
  const [firestoreError, setFirestoreError] = useState("");
  const [chatThreads, setChatThreads] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatStatus, setChatStatus] = useState("Idle");
  const [chatError, setChatError] = useState("");
  const [chatRequestId, setChatRequestId] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const autoSelectChatRef = useRef(false);
  const safeConfig = useMemo(
    () => sanitizeFirebaseConfig(firebaseConfig),
    [firebaseConfig]
  );
  const firebaseReady = useMemo(
    () => enabled && isFirebaseConfigReady(safeConfig),
    [enabled, safeConfig]
  );

  const reportFirestoreError = (err, fallback) => {
    const missing = isFirestoreDatabaseMissing(err);
    const message = err?.message || fallback;
    setFirestoreStatus("Error");
    setFirestoreError(missing ? FIRESTORE_MISSING_MESSAGE : message);
    if (missing) {
      setFirestoreDb(null);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setFirestoreDb(null);
      setFirestoreStatus("Disabled");
      setFirestoreError("");
      return;
    }
    if (!firebaseReady) {
      setFirestoreDb(null);
      setFirestoreStatus("Missing config");
      setFirestoreError("");
      return;
    }

    try {
      setFirestoreStatus("Connecting...");
      const appName = `relay-${safeConfig.projectId}`;
      const existingApp = getApps().find((app) => app.name === appName);
      const app = existingApp || initializeApp(safeConfig, appName);
      const db = getFirestore(app);
      setFirestoreDb(db);
      setFirestoreStatus("Connected");
      setFirestoreError("");
    } catch (err) {
      setFirestoreDb(null);
      setFirestoreStatus("Error");
      setFirestoreError(err?.message || "Failed to initialize Firestore.");
    }
  }, [enabled, firebaseReady, safeConfig]);

  useEffect(() => {
    if (!firestoreDb) {
      setChatThreads([]);
      setChatMessages([]);
      setActiveChatId("");
      return;
    }

    const chatsQuery = query(
      collection(firestoreDb, "chats"),
      orderBy("updatedAt", "desc"),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      chatsQuery,
      (snapshot) => {
        const nextThreads = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setChatThreads(nextThreads);
      },
      (err) => {
        reportFirestoreError(err, "Failed to load chats.");
      }
    );

    return unsubscribe;
  }, [firestoreDb]);

  useEffect(() => {
    if (!firestoreDb || !activeChatId) {
      setChatMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(firestoreDb, "chats", activeChatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setChatMessages(nextMessages);
      },
      (err) => {
        setChatError(err?.message || "Failed to load messages.");
        reportFirestoreError(err, "Failed to load messages.");
      }
    );

    return unsubscribe;
  }, [firestoreDb, activeChatId]);

  useEffect(() => {
    if (autoSelectChatRef.current) {
      return;
    }
    if (!activeChatId && chatThreads.length > 0) {
      setActiveChatId(chatThreads[0].id);
      autoSelectChatRef.current = true;
    }
  }, [activeChatId, chatThreads]);

  const activeChat = useMemo(
    () => chatThreads.find((thread) => thread.id === activeChatId) || null,
    [chatThreads, activeChatId]
  );

  const ensureChatThread = async (lastMessage) => {
    let chatId = activeChatId;
    if (!chatId) {
      const chatDoc = await addDoc(collection(firestoreDb, "chats"), {
        title: createChatTitle(lastMessage),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: truncateText(lastMessage, 120),
        model,
      });
      chatId = chatDoc.id;
      setActiveChatId(chatId);
      autoSelectChatRef.current = true;
    } else {
      await updateDoc(doc(firestoreDb, "chats", chatId), {
        updatedAt: serverTimestamp(),
        lastMessage: truncateText(lastMessage, 120),
        model,
      });
    }
    return chatId;
  };

  const startNewChat = () => {
    autoSelectChatRef.current = true;
    setActiveChatId("");
    setChatMessages([]);
    setChatError("");
    setChatRequestId("");
    setChatStatus("Idle");
  };

  const selectChat = (chatId) => {
    autoSelectChatRef.current = true;
    setActiveChatId(chatId);
    setChatError("");
    setChatRequestId("");
    setChatStatus("Idle");
  };

  const sendMessage = async (content) => {
    if (isChatLoading) {
      return;
    }
    const trimmed = content?.trim();
    if (!trimmed) {
      return;
    }
    if (!apiKey?.trim()) {
      setChatStatus("Error");
      setChatError("API key is required.");
      return;
    }
    if (firestoreStatus === "Error") {
      setChatStatus("Error");
      setChatError(firestoreError || "Firestore is not available.");
      return;
    }
    if (!firestoreDb) {
      setChatStatus("Error");
      setChatError(
        enabled
          ? "Connect Firebase to store chat history."
          : "Enable Firestore sync to store chat history."
      );
      return;
    }

    const userMessage = { role: "user", content: trimmed };
    const nextMessages = [...chatMessages, userMessage]
      .filter((message) => message?.role && message?.content)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setChatError("");
    setChatRequestId("");
    setChatStatus("Thinking...");
    setIsChatLoading(true);

    try {
      const chatId = await ensureChatThread(trimmed);
      const messagesRef = collection(firestoreDb, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        role: "user",
        content: trimmed,
        createdAt: serverTimestamp(),
      });

      const result = await sendChat({
        baseUrl: apiBase,
        apiKey,
        adminSecret,
        model,
        messages: nextMessages,
      });
      await addDoc(messagesRef, {
        role: "assistant",
        content: result.text || "",
        createdAt: serverTimestamp(),
        requestId: result.requestId || "",
      });
      await updateDoc(doc(firestoreDb, "chats", chatId), {
        updatedAt: serverTimestamp(),
        lastMessage: truncateText(result.text || "", 120),
      });
      setChatRequestId(result.requestId || "");
      setChatStatus("Done");
    } catch (err) {
      setChatStatus("Error");
      setChatError(err?.message || "Chat failed.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const sendImage = async ({ prompt, options }) => {
    if (isChatLoading) {
      return;
    }
    const trimmed = prompt?.trim();
    if (!trimmed) {
      return;
    }
    if (!apiKey?.trim()) {
      setChatStatus("Error");
      setChatError("API key is required.");
      return;
    }
    if (firestoreStatus === "Error") {
      setChatStatus("Error");
      setChatError(firestoreError || "Firestore is not available.");
      return;
    }
    if (!firestoreDb) {
      setChatStatus("Error");
      setChatError(
        enabled
          ? "Connect Firebase to store chat history."
          : "Enable Firestore sync to store chat history."
      );
      return;
    }

    setChatError("");
    setChatRequestId("");
    setChatStatus("Thinking...");
    setIsChatLoading(true);

    try {
      const chatId = await ensureChatThread(trimmed);
      const messagesRef = collection(firestoreDb, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        role: "user",
        content: trimmed,
        mode: "image",
        createdAt: serverTimestamp(),
      });

      const result = await generateImage({
        baseUrl: apiBase,
        apiKey,
        adminSecret,
        prompt: trimmed,
        negativePrompt: options?.negativePrompt,
        width: options?.width,
        height: options?.height,
        steps: options?.steps,
        guidance: options?.guidance,
        seed: options?.seed,
        count: options?.count,
      });
      const images = Array.isArray(result.data?.images) ? result.data.images : [];
      if (!images.length) {
        throw new Error("No images returned.");
      }
      for (const imageUrl of images) {
        await addDoc(messagesRef, {
          role: "assistant",
          type: "image",
          content: trimmed,
          imageUrl,
          createdAt: serverTimestamp(),
          requestId: result.requestId || "",
        });
      }
      await updateDoc(doc(firestoreDb, "chats", chatId), {
        updatedAt: serverTimestamp(),
        lastMessage: truncateText(trimmed, 120),
      });
      setChatRequestId(result.requestId || "");
      setChatStatus("Done");
    } catch (err) {
      setChatStatus("Error");
      setChatError(err?.message || "Image generation failed.");
    } finally {
      setIsChatLoading(false);
    }
  };

  return {
    firestoreDb,
    firestoreStatus,
    firestoreError,
    chatThreads,
    activeChatId,
    activeChat,
    chatMessages,
    chatStatus,
    chatError,
    chatRequestId,
    isChatLoading,
    startNewChat,
    selectChat,
    sendMessage,
    sendImage,
  };
};
