import Card from "../ui/Card.jsx";
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
}) => {
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
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`chat ${
                  message.role === "user" ? "chat-end" : "chat-start"
                }`}
              >
                <div className="chat-header text-xs opacity-60">
                  {message.role === "user" ? "You" : "Assistant"}
                  {message.createdAt ? (
                    <span className="ml-2">
                      {formatTimestamp(message.createdAt)}
                    </span>
                  ) : null}
                </div>
                <div
                  className={`chat-bubble ${
                    message.role === "user" ? "chat-bubble-primary" : ""
                  }`}
                >
                  {message.type === "image" && message.imageUrl ? (
                    <div className="space-y-3">
                      <img
                        src={message.imageUrl}
                        alt={message.content || "Generated image"}
                        className="max-w-full rounded-box border border-base-200"
                      />
                      {message.content ? (
                        <p className="text-xs text-base-content/70">
                          {message.content}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))
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
