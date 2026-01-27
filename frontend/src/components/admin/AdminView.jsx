import Card from "../ui/Card.jsx";
import { FIREBASE_FIELDS } from "../../config/appConfig.js";

const AdminView = ({
  settings,
  updateSetting,
  updateFirebase,
  firebasePreview,
  prompt,
  setPrompt,
  payloadPreview,
  canSubmit,
  isLoading,
  status,
  statusTone,
  requestId,
  error,
  output,
  defaultModel,
  adminSecretLocked,
  adminStatus,
  adminTone,
  adminError,
  adminRequestId,
  adminTargetKey,
  setAdminTargetKey,
  keysLimit,
  setKeysLimit,
  isAdminLoading,
  generatedKey,
  adminKeys,
  adminUsage,
  handleGenerate,
  handleStop,
  handleClear,
  handleGenerateKey,
  handleActivateKey,
  handleRevokeKey,
  handleListKeys,
  handleFetchUsage,
}) => {
  return (
    <main className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="card-title text-2xl">Admin settings</h2>
          <span className="text-sm text-base-content/60">Configuration</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">API Base URL</span>
            </div>
            <input
              type="url"
              value={settings.apiBase}
              onChange={(event) => updateSetting("apiBase", event.target.value)}
              placeholder="http://localhost:8080"
              className="input input-bordered bg-base-100"
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">API Key</span>
            </div>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) => updateSetting("apiKey", event.target.value)}
              placeholder="Paste X-API-Key"
              className="input input-bordered bg-base-100"
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">Admin Secret</span>
            </div>
            {adminSecretLocked ? (
              <div className="rounded-box border border-base-200 bg-base-100 px-4 py-3 text-sm text-base-content/70">
                Loaded from environment configuration.
              </div>
            ) : (
              <input
                type="password"
                value={settings.adminSecret}
                onChange={(event) => updateSetting("adminSecret", event.target.value)}
                placeholder="Admin-Secret header"
                className="input input-bordered bg-base-100"
              />
            )}
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">Default model</span>
            </div>
            <input
              type="text"
              value={settings.model}
              onChange={(event) => updateSetting("model", event.target.value)}
              placeholder={defaultModel}
              list="model-options"
              className="input input-bordered bg-base-100"
            />
          </label>
        </div>

        <div className="collapse collapse-arrow border border-base-200 bg-base-200">
          <input type="checkbox" />
          <div className="collapse-title text-sm font-semibold">Firebase config</div>
          <div className="collapse-content">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-200 bg-base-100 px-4 py-3">
              <label className="label cursor-pointer gap-3">
                <input
                  type="checkbox"
                  checked={settings.firestoreEnabled}
                  onChange={(event) =>
                    updateSetting("firestoreEnabled", event.target.checked)
                  }
                  className="toggle toggle-primary"
                />
                <span className="label-text font-medium">Enable Firestore sync</span>
              </label>
              <p className="text-xs text-base-content/60">
                Turns on realtime listeners for chat history.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {FIREBASE_FIELDS.map((field) => (
                <label className="form-control w-full" key={field.key}>
                  <div className="label">
                    <span className="label-text">{field.label}</span>
                  </div>
                  <input
                    type="text"
                    value={settings.firebaseConfig?.[field.key] || ""}
                    onChange={(event) => updateFirebase(field.key, event.target.value)}
                    className="input input-bordered bg-base-100"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 rounded-box border border-base-200 bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                JSON preview
              </p>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{firebasePreview}</pre>
            </div>
          </div>
        </div>

        <div className="divider">Request builder</div>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">Prompt</span>
          </div>
          <textarea
            rows={5}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="textarea textarea-bordered bg-base-100"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-200 bg-base-100 px-4 py-3">
          <label className="label cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={settings.stream}
              onChange={(event) => updateSetting("stream", event.target.checked)}
              className="toggle toggle-primary"
            />
            <span className="label-text font-medium">Stream response</span>
          </label>
          <p className="text-sm text-base-content/60">
            {settings.stream
              ? "Uses raw chunked JSON from /api/generate."
              : "Uses format=text for a single plain response."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? "Working..." : "Generate"}
          </button>
          <button className="btn btn-outline" onClick={handleStop} disabled={!isLoading}>
            Stop
          </button>
          <button className="btn btn-ghost" onClick={handleClear} disabled={isLoading}>
            Clear
          </button>
        </div>

        <div className="stats stats-vertical border border-base-200 bg-base-100 text-base-content md:stats-horizontal">
          <div className="stat">
            <div className="stat-title">Status</div>
            <div className="stat-value text-lg">
              <span className={`badge ${statusTone}`}>{status}</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">Request ID</div>
            <div className="stat-value text-sm">
              <span className="kbd kbd-sm">{requestId || "-"}</span>
            </div>
          </div>
        </div>

        <div className="collapse collapse-arrow border border-base-200 bg-base-200">
          <input type="checkbox" defaultChecked />
          <div className="collapse-title text-sm font-semibold">Payload preview</div>
          <div className="collapse-content">
            <pre className="rounded-box bg-base-100 p-4 text-xs">{payloadPreview}</pre>
          </div>
        </div>
      </Card>

      <div className="grid gap-8">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="card-title text-2xl">Response</h2>
            <span className="text-sm text-base-content/60">
              {settings.stream ? "Streaming" : "Plain text"}
            </span>
          </div>

          {error ? (
            <div className="alert alert-error">
              <div>
                <h3 className="font-semibold">Request failed</h3>
                <p className="mono text-sm opacity-90">{error}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-box border border-base-200 bg-base-100 p-4">
              <pre className="mono min-h-[280px] whitespace-pre-wrap text-sm">
                {output || "Responses appear here once the request completes."}
              </pre>
            </div>
          )}

          <div className="rounded-box border border-base-200 bg-base-100 p-4">
            <p className="text-sm text-base-content/70">
              Tip: Streaming works best when your client reads chunks as they arrive. For
              plain responses, switch off streaming and use format=text.
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="card-title text-2xl">Admin actions</h2>
            <span className={`badge ${adminTone}`}>{adminStatus}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text">Target API key</span>
              </div>
              <input
                type="text"
                value={adminTargetKey}
                onChange={(event) => setAdminTargetKey(event.target.value)}
                placeholder="Key to activate/revoke or fetch usage"
                className="input input-bordered bg-base-100"
              />
            </label>
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text">List limit</span>
              </div>
              <input
                type="number"
                min={1}
                max={500}
                value={keysLimit}
                onChange={(event) => setKeysLimit(event.target.value)}
                className="input input-bordered bg-base-100"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              onClick={handleGenerateKey}
              disabled={isAdminLoading}
            >
              Generate key
            </button>
            <button
              className="btn btn-outline"
              onClick={handleActivateKey}
              disabled={isAdminLoading}
            >
              Activate key
            </button>
            <button
              className="btn btn-outline"
              onClick={handleRevokeKey}
              disabled={isAdminLoading}
            >
              Revoke key
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleListKeys}
              disabled={isAdminLoading}
            >
              List keys
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleFetchUsage}
              disabled={isAdminLoading}
            >
              Fetch usage
            </button>
          </div>

          {adminError ? (
            <div className="alert alert-error">
              <div>
                <h3 className="font-semibold">Admin action failed</h3>
                <p className="mono text-sm opacity-90">{adminError}</p>
              </div>
            </div>
          ) : null}

          {generatedKey ? (
            <div className="rounded-box border border-base-200 bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                Generated key
              </p>
              <p className="mt-2 break-all font-mono text-sm">{generatedKey}</p>
            </div>
          ) : null}

          {adminKeys.length ? (
            <div className="rounded-box border border-base-200 bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                Keys ({adminKeys.length})
              </p>
              <div className="mt-3 space-y-3 text-sm">
                {adminKeys.map((key) => (
                  <div key={key.api_key} className="rounded-box border border-base-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{key.api_key}</span>
                      <span className="badge badge-outline">
                        {key.status || "unknown"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-base-content/60">
                      {key.description || "No description"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {adminUsage ? (
            <div className="rounded-box border border-base-200 bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                Usage summary
              </p>
              <pre className="mt-2 whitespace-pre-wrap text-xs">
                {JSON.stringify(adminUsage, null, 2)}
              </pre>
            </div>
          ) : null}

          <div className="stats stats-vertical border border-base-200 bg-base-100 text-base-content md:stats-horizontal">
            <div className="stat">
              <div className="stat-title">Status</div>
              <div className="stat-value text-lg">
                <span className={`badge ${adminTone}`}>{adminStatus}</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">Request ID</div>
              <div className="stat-value text-sm">
                <span className="kbd kbd-sm">{adminRequestId || "-"}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default AdminView;
