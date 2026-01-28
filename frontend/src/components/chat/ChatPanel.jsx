import Card from "../ui/Card.jsx";
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
  variant = "studio",
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
      className={`chat ${message.role === "user" ? "chat-end" : "chat-start"}`}
    >
      <div className="chat-header text-xs opacity-60">
        {message.role === "user" ? "You" : "Assistant"}
        {message.createdAt ? (
          <span className="ml-2">{formatTimestamp(message.createdAt)}</span>
        ) : null}
      </div>
      <div
        className={`chat-bubble ${
          message.role === "user" ? "chat-bubble-primary" : ""
        }`}
      >
        {renderMessageContent(message)}
      </div>
    </div>
  );

  const renderPublicMessage = (message) => {
    const isUser = message.role === "user";
    return (
      <div
        key={message.id}
        className={`flex flex-col gap-2 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
          <span>{isUser ? "You" : "Assistant"}</span>
          {message.createdAt ? (
            <span className="text-[10px] tracking-[0.2em] text-slate-300">
              {formatTimestamp(message.createdAt)}
            </span>
          ) : null}
        </div>
        <div
          className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-900"
          }`}
        >
          {renderMessageContent(message)}
        </div>
      </div>
    );
  };

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
        {chatMessages.map((message) =>
          variant === "public"
            ? renderPublicMessage(message)
            : renderStudioMessage(message)
        )}
      </div>
    );
  };

  if (variant === "public") {
    return (
      <section className="flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Chat session
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              {activeChat?.title || "New chat"}
            </h2>
            <p className="text-xs text-slate-500">
              {activeChat
                ? `Last updated ${formatTimestamp(activeChat.updatedAt) || "just now"}`
                : "Start a new conversation."}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
          <div className="border-b border-slate-200/70 px-6 py-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {chatError}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-6 py-8">{renderMessages()}</div>

        <footer className="border-t border-slate-200/70 px-5 py-5">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2">
                <button
                  className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    inputMode === "text"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                  onClick={() => onInputModeChange("text")}
                  type="button"
                >
                  Text
                </button>
                <button
                  className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    inputMode === "image"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                  onClick={() => onInputModeChange("image")}
                  type="button"
                >
                  Image
                </button>
              </div>
              <div className="text-xs text-slate-500">
                Request ID: {chatRequestId || "-"}
              </div>
            </div>

            {inputMode === "image" ? (
              <div className="grid gap-3 pb-3 md:grid-cols-3">
                <label className="form-control w-full">
                  <span className="label-text text-xs text-slate-500">
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
                  <span className="label-text text-xs text-slate-500">Steps</span>
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
                  <span className="label-text text-xs text-slate-500">
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
                  <span className="label-text text-xs text-slate-500">
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
                className="textarea textarea-bordered flex-1 resize-none bg-white text-sm"
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
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="card-title text-2xl">
            {activeChat?.title || "New chat"}
          </h2>
          <p className="text-xs text-base-content/60">
            {activeChat
              ? `Last updated ${formatTimestamp(activeChat.updatedAt) || "just now"}`
              : "Start a new conversation and watch it sync."}
          </p>
        </div>
        <span className={`badge ${chatTone}`}>{chatStatus}</span>
      </div>

      <div className="rounded-box border border-base-200 bg-base-100 p-4">
        <div className="flex max-h-[420px] flex-col gap-4 overflow-y-auto pr-1">
          {chatMessages.length === 0 ? (
            <p className="text-sm text-base-content/60">{chatEmptyState}</p>
          ) : (
            chatMessages.map(renderStudioMessage)
          )}
        </div>
      </div>

      {chatError ? (
        <div className="alert alert-error">
          <div>
            <h3 className="font-semibold">Chat failed</h3>
            <p className="mono text-sm opacity-90">{chatError}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.3em] text-base-content/60">
          Mode
        </span>
        <div className="join">
          <button
            className={`btn join-item btn-sm ${
              inputMode === "text" ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => onInputModeChange("text")}
            type="button"
          >
            Text
          </button>
          <button
            className={`btn join-item btn-sm ${
              inputMode === "image" ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => onInputModeChange("image")}
            type="button"
          >
            Image
          </button>
        </div>
      </div>

      {inputMode === "image" ? (
        <div className="grid gap-4 rounded-box border border-base-200 bg-base-100 p-4 md:grid-cols-3">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">Image size</span>
            </div>
            <select
              className="select select-bordered"
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
            <div className="label">
              <span className="label-text">Steps</span>
            </div>
            <input
              type="number"
              min={5}
              max={60}
              value={imageOptions.steps}
              onChange={(event) =>
                onImageOptionsChange({ steps: Number(event.target.value) })
              }
              className="input input-bordered"
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">Guidance</span>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={imageOptions.guidance}
              onChange={(event) =>
                onImageOptionsChange({ guidance: Number(event.target.value) })
              }
              className="input input-bordered"
            />
          </label>
          <label className="form-control w-full md:col-span-3">
            <div className="label">
              <span className="label-text">Negative prompt (optional)</span>
            </div>
            <input
              type="text"
              value={imageOptions.negativePrompt}
              onChange={(event) =>
                onImageOptionsChange({ negativePrompt: event.target.value })
              }
              className="input input-bordered"
            />
          </label>
        </div>
      ) : null}

      <label className="form-control w-full">
        <div className="label">
          <span className="label-text">
            {inputMode === "image" ? "Describe the image" : "Your message"}
          </span>
        </div>
        <textarea
          rows={3}
          value={chatInput}
          onChange={(event) => onChatInputChange(event.target.value)}
          className="textarea textarea-bordered bg-base-100"
          disabled={!hasFirestore}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          className="btn btn-primary"
          onClick={onSendChat}
          disabled={!canChat || isChatLoading}
        >
          {isChatLoading ? "Sending..." : "Send"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={onStartNewChat}
          disabled={isChatLoading}
        >
          Start new chat
        </button>
      </div>

      <div className="stats stats-vertical border border-base-200 bg-base-100 text-base-content md:stats-horizontal">
        <div className="stat">
          <div className="stat-title">Status</div>
          <div className="stat-value text-lg">
            <span className={`badge ${chatTone}`}>{chatStatus}</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Request ID</div>
          <div className="stat-value text-sm">
            <span className="kbd kbd-sm">{chatRequestId || "-"}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChatPanel;
