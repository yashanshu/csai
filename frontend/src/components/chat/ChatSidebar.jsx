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
  collapsed = false,
  onToggleCollapse,
  searchTerm,
  onSearchTermChange,
  apiKey,
  apiBase,
  model,
  onUpdateSetting,
  isPublicRoute,
}) => {
  const filteredThreads = chatThreads.filter((thread) => {
    if (!searchTerm) {
      return true;
    }
    const needle = searchTerm.toLowerCase();
    const title = (thread.title || "").toLowerCase();
    const last = (thread.lastMessage || "").toLowerCase();
    return title.includes(needle) || last.includes(needle);
  });

  return (
    <aside
      className={`flex h-full flex-col border-r border-base-200 bg-base-100/70 transition-all ${
        collapsed ? "w-20" : "w-full md:w-80"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        {collapsed ? (
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">CS</span>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-base-content/60">
              Chats
            </p>
            <h2 className="text-lg font-semibold">History</h2>
          </div>
        )}
        <button className="btn btn-ghost btn-xs" onClick={onToggleCollapse}>
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <div className="px-4">
        <button
          className="btn btn-primary btn-sm w-full"
          onClick={onStartNewChat}
          type="button"
        >
          {collapsed ? "+" : "New chat"}
        </button>
      </div>

      {collapsed ? null : (
        <div className="px-4 pt-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            className="input input-bordered w-full"
            placeholder="Search chats"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {hasFirestore ? (
          filteredThreads.length ? (
            <div className="space-y-2">
              {filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => onSelectChat(thread.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    thread.id === activeChatId
                      ? "border-primary/60 bg-base-100 shadow-sm"
                      : "border-base-200/70 bg-base-200/40 hover:border-base-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">
                      {thread.title || "Untitled chat"}
                    </p>
                    <span className="text-[11px] text-base-content/60">
                      {formatTimestamp(thread.updatedAt)}
                    </span>
                  </div>
                  {collapsed ? null : (
                    <p className="mt-1 text-xs text-base-content/60">
                      {thread.lastMessage
                        ? truncateText(thread.lastMessage, 96)
                        : "No messages yet."}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-base-content/60">
              No chat history yet. Start a new conversation.
            </p>
          )
        ) : (
          <p className="text-sm text-base-content/60">
            {isPublicRoute
              ? "History is unavailable until Firebase is configured."
              : "Enable Firestore in Admin to use chat history."}
          </p>
        )}
      </div>

      <div className="border-t border-base-200 px-4 py-4">
        {collapsed ? (
          <span className={`badge badge-sm ${firestoreTone}`}>{firestoreStatus}</span>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-base-content/60">
              <span>Sync</span>
              <span className={`badge badge-sm ${firestoreTone}`}>{firestoreStatus}</span>
            </div>
            {firestoreError ? (
              <div className="rounded-2xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
                {firestoreError}
              </div>
            ) : null}
            {isPublicRoute ? null : (
              <div className="space-y-2">
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-xs">API Base</span>
                  </div>
                  <input
                    type="url"
                    value={apiBase}
                    onChange={(event) => onUpdateSetting("apiBase", event.target.value)}
                    aria-label="API Base"
                    className="input input-bordered input-sm"
                  />
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-xs">API Key</span>
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => onUpdateSetting("apiKey", event.target.value)}
                    aria-label="API Key"
                    className="input input-bordered input-sm"
                  />
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-xs">Model</span>
                  </div>
                  <input
                    type="text"
                    value={model}
                    onChange={(event) => onUpdateSetting("model", event.target.value)}
                    list="model-options"
                    aria-label="Model"
                    className="input input-bordered input-sm"
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default ChatSidebar;
