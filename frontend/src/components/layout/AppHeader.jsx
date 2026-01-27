const AppHeader = ({ view, onChangeView }) => {
  return (
    <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-base-content/60">
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_6px_rgba(31,122,93,0.15)]" />
          Ollama Relay Studio
        </div>
        <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
          Admin config. User chat.
        </h1>
        <p className="text-lg text-base-content/70">
          Switch between an admin console for settings and a clean chat interface
          for daily users.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="tabs tabs-boxed">
          <button
            className={`tab ${view === "user" ? "tab-active" : ""}`}
            onClick={() => onChangeView("user")}
          >
            User chat
          </button>
          <button
            className={`tab ${view === "admin" ? "tab-active" : ""}`}
            onClick={() => onChangeView("admin")}
          >
            Admin
          </button>
        </div>
        <span className="badge badge-outline">Local UI</span>
      </div>
    </header>
  );
};

export default AppHeader;
