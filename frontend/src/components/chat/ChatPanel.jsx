import MarkdownRenderer from "../ui/MarkdownRenderer.jsx";
import { formatTimestamp } from "../../lib/chatUtils.js";

const ChatPanel = ({
  activeChat,
  chatStatus,
  chatTone,
  chatMessages,
  chatEmptyState,
  chatError,
  chatInput,
  onChatInputChange,
  onSendChat,
  onStartNewChat,
  isChatLoading,
  canChat,
  chatRequestId,
  hasFirestore,
  inputMode,
  onInputModeChange,
  imageOptions,
  onImageOptionsChange,
  model,
  onModelChange,
  onToggleSidebar,
  sidebarCollapsed,
}) => {
  const renderMessageContent = (message) => {
    if (message.type === "image" && message.imageUrl) {
      return (
        <div className="space-y-3">
          <img
            src={message.imageUrl}
            alt={message.content || "Generated image"}
            className="max-w-full rounded-2xl border border-base-200"
          />
          {message.content ? (
            <MarkdownRenderer
              content={message.content}
              className="text-xs text-base-content/70"
            />
          ) : null}
        </div>
      );
    }
    return <MarkdownRenderer content={message.content} />;
  };

  const renderStudioMessage = (message) => (
    <div
      key={message.id}
      className={`flex w-full flex-col ${
        message.role === "user" ? "items-end" : "items-start"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-base-content/40">
        <span>{message.role === "user" ? "You" : "Assistant"}</span>
        {message.createdAt ? (
          <span className="ml-2">{formatTimestamp(message.createdAt)}</span>
        ) : null}
      </div>
      <div
        className={`max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${
          message.role === "user"
            ? "border-primary/40 bg-primary text-primary-content"
            : "border-base-200 bg-base-100 text-base-content"
        }`}
      >
        {renderMessageContent(message)}
      </div>
    </div>
  );

  const renderMessages = () => {
    if (!chatMessages.length) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md text-center text-sm text-base-content/60">
            {chatEmptyState}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        {chatMessages.map((message) => renderStudioMessage(message))}
      </div>
    );
  };

  return (
    <section className="flex min-h-[75vh] flex-1 flex-col rounded-[28px] border border-base-200 bg-base-100/70 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-base-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm" onClick={onToggleSidebar}>
            {sidebarCollapsed ? "Show history" : "Hide history"}
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
              Conversation
            </p>
            <h2 className="text-lg font-semibold">
              {activeChat?.title || "New chat"}
            </h2>
            <p className="text-xs text-base-content/60">
              {activeChat
                ? `Last updated ${formatTimestamp(activeChat.updatedAt) || "just now"}`
                : "Start a new conversation."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="form-control">
            <div className="label">
              <span className="label-text text-xs">Model</span>
            </div>
            <input
              type="text"
              value={model}
              onChange={(event) => onModelChange(event.target.value)}
              list="model-options"
              className="input input-bordered input-sm"
            />
          </label>
          <span className={`badge ${chatTone}`}>{chatStatus}</span>
          <button
            className="btn btn-sm btn-outline"
            onClick={onStartNewChat}
            disabled={isChatLoading}
            type="button"
          >
            New chat
          </button>
        </div>
      </header>

      {chatError ? (
        <div className="border-b border-base-200 px-6 py-3">
          <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {chatError}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-6 py-8">{renderMessages()}</div>

      <footer className="border-t border-base-200 px-5 py-5">
        <div className="rounded-2xl border border-base-200 bg-base-100 px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <div className="flex items-center gap-2">
              <button
                className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  inputMode === "text"
                    ? "bg-base-300 text-base-content"
                    : "bg-base-200 text-base-content/60"
                }`}
                onClick={() => onInputModeChange("text")}
                type="button"
              >
                Text
              </button>
              <button
                className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  inputMode === "image"
                    ? "bg-base-300 text-base-content"
                    : "bg-base-200 text-base-content/60"
                }`}
                onClick={() => onInputModeChange("image")}
                type="button"
              >
                Image
              </button>
            </div>
            <div className="text-xs text-base-content/60">
              Request ID: {chatRequestId || "-"}
            </div>
          </div>

          {inputMode === "image" ? (
            <div className="grid gap-3 pb-3 md:grid-cols-3">
              <label className="form-control w-full">
                <span className="label-text text-xs text-base-content/60">
                  Image size
                </span>
                <select
                  className="select select-bordered select-sm"
                  value={`${imageOptions.width}x${imageOptions.height}`}
                  onChange={(event) => {
                    const [width, height] = event.target.value
                      .split("x")
                      .map((value) => Number(value));
                    onImageOptionsChange({ width, height });
                  }}
                >
                  <option value="512x512">512 x 512</option>
                  <option value="640x640">640 x 640</option>
                  <option value="768x768">768 x 768</option>
                  <option value="832x832">832 x 832</option>
                </select>
              </label>
              <label className="form-control w-full">
                <span className="label-text text-xs text-base-content/60">Steps</span>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={imageOptions.steps}
                  onChange={(event) =>
                    onImageOptionsChange({ steps: Number(event.target.value) })
                  }
                  className="input input-bordered input-sm"
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text text-xs text-base-content/60">
                  Guidance
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={0.5}
                  value={imageOptions.guidance}
                  onChange={(event) =>
                    onImageOptionsChange({ guidance: Number(event.target.value) })
                  }
                  className="input input-bordered input-sm"
                />
              </label>
              <label className="form-control w-full md:col-span-3">
                <span className="label-text text-xs text-base-content/60">
                  Negative prompt (optional)
                </span>
                <input
                  type="text"
                  value={imageOptions.negativePrompt}
                  onChange={(event) =>
                    onImageOptionsChange({ negativePrompt: event.target.value })
                  }
                  className="input input-bordered input-sm"
                />
              </label>
            </div>
          ) : null}

          <div className="flex items-end gap-3">
            <textarea
              rows={2}
              value={chatInput}
              onChange={(event) => onChatInputChange(event.target.value)}
              aria-label="Chat input"
              className="textarea textarea-bordered flex-1 resize-none bg-base-100 text-sm"
              placeholder={
                hasFirestore
                  ? inputMode === "image"
                    ? "Describe the image you want to create"
                    : "Message the assistant..."
                  : "Connect Firebase to start chatting."
              }
              disabled={!hasFirestore}
            />
            <button
              className="btn btn-primary"
              onClick={onSendChat}
              disabled={!canChat || isChatLoading}
            >
              {isChatLoading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
};

export default ChatPanel;
