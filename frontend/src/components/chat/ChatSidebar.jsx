import Card from "../ui/Card.jsx";
import { formatTimestamp, truncateText } from "../../lib/chatUtils.js";

const ChatSidebar = ({
  firestoreStatus,
  firestoreTone,
  firestoreError,
  chatThreads,
  activeChatId,
  onSelectChat,
  onStartNewChat,
  hasFirestore,
}) => {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="card-title text-2xl">Conversations</h2>
        <button className="btn btn-sm btn-outline" onClick={onStartNewChat}>
          New chat
        </button>
      </div>

      <div className="flex items-center justify-between rounded-box border border-base-200 bg-base-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Firestore sync</p>
          <p className="text-xs text-base-content/60">
            {firestoreStatus === "Connected"
              ? "Chat history is synced to Firestore."
              : firestoreStatus === "Disabled"
                ? "Firestore sync is disabled."
              : "Connect Firebase to sync chat history."}
          </p>
        </div>
        <span className={`badge ${firestoreTone}`}>{firestoreStatus}</span>
      </div>

      {firestoreError ? (
        <div className="alert alert-error">
          <div>
            <h3 className="font-semibold">Firestore error</h3>
            <p className="mono text-sm opacity-90">{firestoreError}</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-box border border-base-200 bg-base-100 p-3">
        <div className="max-h-[360px] space-y-2 overflow-y-auto">
          {hasFirestore ? (
            chatThreads.length ? (
              chatThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => onSelectChat(thread.id)}
                  className={`w-full rounded-box border px-4 py-3 text-left transition ${
                    thread.id === activeChatId
                      ? "border-primary/60 bg-base-100 shadow-sm"
                      : "border-base-200 bg-base-200/60 hover:border-base-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold">{thread.title || "Untitled chat"}</p>
                    <span className="text-xs text-base-content/60">
                      {formatTimestamp(thread.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-base-content/60">
                    {thread.lastMessage
                      ? truncateText(thread.lastMessage, 96)
                      : "No messages yet."}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-base-content/60">
                No chat history yet. Start a new conversation to see it here.
              </p>
            )
          ) : (
            <p className="text-sm text-base-content/60">
              {firestoreStatus === "Disabled"
                ? "Firestore sync is disabled. Enable it in Admin to use history."
                : "Firebase is not connected. Add config in Admin to enable history."}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ChatSidebar;
