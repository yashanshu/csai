import Card from "../ui/Card.jsx";

const ConnectionCard = ({ settings, onUpdateSetting, defaultModel, onOpenAdmin }) => {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="card-title text-2xl">Connection</h2>
        <button className="btn btn-xs btn-ghost" onClick={onOpenAdmin}>
          Edit admin settings
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">API Key</span>
          </div>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(event) => onUpdateSetting("apiKey", event.target.value)}
            placeholder="Paste X-API-Key"
            className="input input-bordered bg-base-100"
          />
        </label>
        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">Model</span>
          </div>
          <input
            type="text"
            value={settings.model}
            onChange={(event) => onUpdateSetting("model", event.target.value)}
            placeholder={defaultModel}
            list="model-options"
            className="input input-bordered bg-base-100"
          />
        </label>
      </div>

      <div className="collapse collapse-arrow border border-base-200 bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-semibold">
          Connection settings
        </div>
        <div className="collapse-content">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text">API Base URL</span>
            </div>
            <input
              type="url"
              value={settings.apiBase}
              onChange={(event) => onUpdateSetting("apiBase", event.target.value)}
              placeholder="http://localhost:8080"
              className="input input-bordered bg-base-100"
            />
          </label>
        </div>
      </div>
    </Card>
  );
};

export default ConnectionCard;
