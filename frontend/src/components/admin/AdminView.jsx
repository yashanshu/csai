import { useMemo, useState } from "react";

import Card from "../ui/Card.jsx";
import MarkdownRenderer from "../ui/MarkdownRenderer.jsx";
import { FIREBASE_FIELDS } from "../../config/appConfig.js";

const SECTION_LABELS = {
  overview: "Overview",
  keys: "API Keys",
  usage: "Usage",
  playground: "Playground",
  observability: "Observability",
  settings: "Settings",
};

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
  adminHealth,
  adminSection,
  setAdminSection,
  handleGenerate,
  handleStop,
  handleClear,
  handleGenerateKey,
  handleActivateKey,
  handleRevokeKey,
  handleListKeys,
  handleFetchUsage,
  handleUpdateKey,
  handleFetchHealth,
}) => {
  const [updateFields, setUpdateFields] = useState({
    description: "",
    status: "",
    rate_limit_per_minute: "",
    quota_per_day: "",
    max_body_bytes: "",
    allowed_models: "",
  });

  const usageItems = useMemo(() => {
    if (!adminUsage) {
      return [];
    }
    if (Array.isArray(adminUsage?.usage)) {
      return adminUsage.usage;
    }
    if (adminUsage?.api_key) {
      return [adminUsage];
    }
    return [];
  }, [adminUsage]);

  const aggregatedUsage = useMemo(() => {
    if (!usageItems.length) {
      return {
        request_count: 0,
        error_count: 0,
        total_tokens: 0,
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        average_latency_ms: 0,
      };
    }
    const totals = usageItems.reduce(
      (acc, item) => {
        acc.request_count += item.request_count || 0;
        acc.error_count += item.error_count || 0;
        acc.total_tokens += item.total_tokens || 0;
        acc.total_prompt_tokens += item.total_prompt_tokens || 0;
        acc.total_completion_tokens += item.total_completion_tokens || 0;
        acc.total_latency_ms += item.average_latency_ms || 0;
        return acc;
      },
      {
        request_count: 0,
        error_count: 0,
        total_tokens: 0,
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        total_latency_ms: 0,
      }
    );
    return {
      ...totals,
      average_latency_ms: Math.round(
        totals.total_latency_ms / Math.max(usageItems.length, 1)
      ),
    };
  }, [usageItems]);

  const updateFieldValue = (key, value) => {
    setUpdateFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyUpdate = async () => {
    const payload = {
      description: updateFields.description || undefined,
      status: updateFields.status || undefined,
      rate_limit_per_minute: updateFields.rate_limit_per_minute
        ? Number(updateFields.rate_limit_per_minute)
        : undefined,
      quota_per_day: updateFields.quota_per_day
        ? Number(updateFields.quota_per_day)
        : undefined,
      max_body_bytes: updateFields.max_body_bytes
        ? Number(updateFields.max_body_bytes)
        : undefined,
      allowed_models: updateFields.allowed_models
        ? updateFields.allowed_models
            .split(",")
            .map((model) => model.trim())
            .filter(Boolean)
        : undefined,
    };
    await handleUpdateKey(adminTargetKey.trim(), payload);
  };

  return (
    <main className="flex min-h-[78vh] w-full flex-col gap-6 lg:flex-row">
      <aside className="w-full rounded-[24px] border border-base-200 bg-base-100/70 p-4 lg:w-64">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
            Admin Console
          </p>
          <h2 className="text-lg font-semibold">Operations</h2>
        </div>
        <nav className="space-y-2">
          {Object.entries(SECTION_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`btn btn-ghost btn-sm w-full justify-start ${
                adminSection === key ? "bg-base-200" : ""
              }`}
              onClick={() => setAdminSection(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-6 rounded-2xl border border-base-200 bg-base-100 p-3 text-xs text-base-content/60">
          <p className="font-semibold uppercase tracking-[0.2em]">Status</p>
          <div className="mt-2 flex items-center justify-between">
            <span className={`badge badge-sm ${adminTone}`}>{adminStatus}</span>
            <span>{adminRequestId || "-"}</span>
          </div>
        </div>
      </aside>

      <section className="flex min-h-[78vh] flex-1 flex-col gap-6">
        {adminError ? (
          <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {adminError}
          </div>
        ) : null}
        {adminSection === "overview" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                  Total requests
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {aggregatedUsage.request_count}
                </p>
              </Card>
              <Card>
                <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                  Error count
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {aggregatedUsage.error_count}
                </p>
              </Card>
              <Card>
                <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                  Avg latency
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {aggregatedUsage.average_latency_ms} ms
                </p>
              </Card>
              <Card>
                <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                  Tokens
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {aggregatedUsage.total_tokens}
                </p>
              </Card>
            </div>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Usage snapshot</h3>
                  <p className="text-sm text-base-content/60">
                    Refresh usage to update per-key metrics.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleFetchUsage}
                    disabled={isAdminLoading}
                  >
                    Refresh usage
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleFetchHealth}
                    disabled={isAdminLoading}
                  >
                    Refresh health
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-base-200 bg-base-100 p-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                    Prompt tokens
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {aggregatedUsage.total_prompt_tokens}
                  </p>
                </div>
                <div className="rounded-2xl border border-base-200 bg-base-100 p-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                    Completion tokens
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {aggregatedUsage.total_completion_tokens}
                  </p>
                </div>
                <div className="rounded-2xl border border-base-200 bg-base-100 p-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                    Active keys
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {Array.isArray(adminKeys) ? adminKeys.length : 0}
                  </p>
                </div>
              </div>
            </Card>
          </>
        ) : null}

        {adminSection === "keys" ? (
          <>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">API keys</h3>
                  <p className="text-sm text-base-content/60">
                    Manage access, revoke keys, and assign limits.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleGenerateKey}
                    disabled={isAdminLoading}
                  >
                    Generate key
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleListKeys}
                    disabled={isAdminLoading}
                  >
                    Refresh list
                  </button>
                </div>
              </div>

              {generatedKey ? (
                <div className="mt-4 rounded-2xl border border-base-200 bg-base-100 p-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                    Generated key
                  </p>
                  <p className="mt-2 break-all font-mono text-sm">{generatedKey}</p>
                </div>
              ) : null}

              <div className="mt-4 overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>API key</th>
                      <th>Status</th>
                      <th>Requests</th>
                      <th>Tokens</th>
                      <th>Last used</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminKeys.length ? (
                      adminKeys.map((key) => (
                        <tr key={key.api_key}>
                          <td className="font-mono text-xs">{key.api_key}</td>
                          <td>{key.status || "unknown"}</td>
                          <td>{key.request_count || 0}</td>
                          <td>{key.total_tokens || 0}</td>
                          <td>{key.last_used || "-"}</td>
                          <td className="space-x-2">
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleActivateKey(key.api_key)}
                            >
                              Activate
                            </button>
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => handleRevokeKey(key.api_key)}
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-sm text-base-content/60">
                          No keys loaded yet. Refresh the list.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <h3 className="text-xl font-semibold">Assign limits & metadata</h3>
              <p className="text-sm text-base-content/60">
                Update an API key with rate limits, quotas, and allowlists.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">Target API key</span>
                  </div>
                  <input
                    type="text"
                    value={adminTargetKey}
                    onChange={(event) => setAdminTargetKey(event.target.value)}
                    placeholder="Key to update"
                    className="input input-bordered bg-base-100"
                  />
                </label>
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">Description</span>
                  </div>
                  <input
                    type="text"
                    value={updateFields.description}
                    onChange={(event) =>
                      updateFieldValue("description", event.target.value)
                    }
                    className="input input-bordered bg-base-100"
                  />
                </label>
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">Status</span>
                  </div>
                  <select
                    className="select select-bordered"
                    value={updateFields.status}
                    onChange={(event) => updateFieldValue("status", event.target.value)}
                  >
                    <option value="">No change</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">Rate limit / minute</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={updateFields.rate_limit_per_minute}
                    onChange={(event) =>
                      updateFieldValue("rate_limit_per_minute", event.target.value)
                    }
                    className="input input-bordered bg-base-100"
                  />
                </label>
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">Quota / day</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={updateFields.quota_per_day}
                    onChange={(event) =>
                      updateFieldValue("quota_per_day", event.target.value)
                    }
                    className="input input-bordered bg-base-100"
                  />
                </label>
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">Max body bytes</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={updateFields.max_body_bytes}
                    onChange={(event) =>
                      updateFieldValue("max_body_bytes", event.target.value)
                    }
                    className="input input-bordered bg-base-100"
                  />
                </label>
                <label className="form-control w-full md:col-span-2">
                  <div className="label">
                    <span className="label-text">Allowed models (comma-separated)</span>
                  </div>
                  <input
                    type="text"
                    value={updateFields.allowed_models}
                    onChange={(event) =>
                      updateFieldValue("allowed_models", event.target.value)
                    }
                    className="input input-bordered bg-base-100"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="btn btn-primary"
                  onClick={handleApplyUpdate}
                  disabled={isAdminLoading}
                >
                  Apply update
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={handleFetchUsage}
                  disabled={isAdminLoading}
                >
                  Refresh usage
                </button>
              </div>
            </Card>
          </>
        ) : null}

        {adminSection === "usage" ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">Usage per key</h3>
                <p className="text-sm text-base-content/60">
                  Track requests, latency, and token usage by key.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={adminTargetKey}
                  onChange={(event) => setAdminTargetKey(event.target.value)}
                  placeholder="Filter by key (optional)"
                  className="input input-bordered input-sm"
                />
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={keysLimit}
                  onChange={(event) => setKeysLimit(event.target.value)}
                  className="input input-bordered input-sm w-24"
                />
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleFetchUsage}
                  disabled={isAdminLoading}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>API key</th>
                    <th>Requests</th>
                    <th>Errors</th>
                    <th>Avg latency</th>
                    <th>Tokens</th>
                    <th>Last used</th>
                  </tr>
                </thead>
                <tbody>
                  {usageItems.length ? (
                    usageItems.map((item) => (
                      <tr key={item.api_key}>
                        <td className="font-mono text-xs">{item.api_key}</td>
                        <td>{item.request_count}</td>
                        <td>{item.error_count}</td>
                        <td>{item.average_latency_ms} ms</td>
                        <td>{item.total_tokens || 0}</td>
                        <td>{item.last_used || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-sm text-base-content/60">
                        No usage data yet. Refresh to load metrics.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {adminSection === "playground" ? (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Playground</h3>
                <p className="text-sm text-base-content/60">
                  Test prompts with your live models.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${statusTone}`}>{status}</span>
                <span className="text-xs text-base-content/60">
                  {requestId || "-"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">Prompt</span>
                  </div>
                  <textarea
                    rows={6}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    className="textarea textarea-bordered bg-base-100"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerate}
                    disabled={!canSubmit || isLoading}
                  >
                    {isLoading ? "Working..." : "Generate"}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={handleStop}
                    disabled={!isLoading}
                  >
                    Stop
                  </button>
                  <button className="btn btn-ghost" onClick={handleClear}>
                    Clear
                  </button>
                </div>
                <div className="rounded-2xl border border-base-200 bg-base-100 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                    Payload preview
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {payloadPreview}
                  </pre>
                </div>
              </div>

              <div className="space-y-4">
                {error ? (
                  <div className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">
                    {error}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-base-200 bg-base-100 p-4">
                    {output ? (
                      <MarkdownRenderer content={output} className="text-sm" />
                    ) : (
                      <p className="text-sm text-base-content/60">
                        Responses appear here once the request completes.
                      </p>
                    )}
                  </div>
                )}
                <div className="rounded-2xl border border-base-200 bg-base-100 p-4 text-xs text-base-content/60">
                  Default model: {defaultModel}
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {adminSection === "observability" ? (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Observability</h3>
                <p className="text-sm text-base-content/60">
                  Monitor upstream health and service status.
                </p>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleFetchHealth}
                disabled={isAdminLoading}
              >
                Refresh health
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-base-200 bg-base-100 p-4">
              <pre className="whitespace-pre-wrap text-xs">
                {adminHealth ? JSON.stringify(adminHealth, null, 2) : "No data yet."}
              </pre>
            </div>
          </Card>
        ) : null}

        {adminSection === "settings" ? (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Configuration</h3>
                <p className="text-sm text-base-content/60">
                  Manage API base, admin secret, and Firebase settings.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                    onChange={(event) =>
                      updateSetting("adminSecret", event.target.value)
                    }
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

            <div className="collapse collapse-arrow mt-6 border border-base-200 bg-base-200">
              <input type="checkbox" />
              <div className="collapse-title text-sm font-semibold">
                Firebase config
              </div>
              <div className="collapse-content">
                <div className="grid gap-4 md:grid-cols-2">
                  {FIREBASE_FIELDS.map((field) => (
                    <label className="form-control w-full" key={field.key}>
                      <div className="label">
                        <span className="label-text">{field.label}</span>
                      </div>
                      <input
                        type="text"
                        value={settings.firebaseConfig?.[field.key] || ""}
                        onChange={(event) =>
                          updateFirebase(field.key, event.target.value)
                        }
                        className="input input-bordered bg-base-100"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 rounded-box border border-base-200 bg-base-100 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                    JSON preview
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {firebasePreview}
                  </pre>
                </div>
              </div>
            </div>
          </Card>
        ) : null}
      </section>
    </main>
  );
};

export default AdminView;
