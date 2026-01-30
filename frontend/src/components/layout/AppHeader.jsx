const AppHeader = ({
  view,
  onChangeView,
  theme,
  onToggleTheme,
  isPublic = false,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-base-200/70 bg-base-100/80 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-content">
            <span className="text-sm font-semibold">AI</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-base-content/60">
              CS AI Console
            </p>
            <h1 className="text-lg font-semibold">Live Chat & Admin</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isPublic ? null : (
            <div className="join">
              <button
                className={`btn join-item btn-sm ${
                  view === "user" ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => onChangeView("user")}
              >
                Chat
              </button>
              <button
                className={`btn join-item btn-sm ${
                  view === "admin" ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => onChangeView("admin")}
              >
                Admin
              </button>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onToggleTheme}>
            {theme === "relay-dark" ? "Light mode" : "Dark mode"}
          </button>
          <span className="badge badge-outline">Console</span>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
