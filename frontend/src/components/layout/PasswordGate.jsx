const PasswordGate = ({
  title = "Private console",
  subtitle = "Enter the access password to continue.",
  password,
  onPasswordChange,
  onSubmit,
  error,
  hasPassword = true,
}) => {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
          Secure access
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>

        {hasPassword ? (
          <>
            <label className="form-control mt-6 w-full">
              <div className="label">
                <span className="label-text">Password</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSubmit();
                  }
                }}
                placeholder="Enter the admin password"
                className="input input-bordered bg-base-100"
              />
            </label>
            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <button
              className="btn btn-primary mt-6 w-full"
              onClick={onSubmit}
              type="button"
            >
              Unlock
            </button>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No admin password is configured. Set `VITE_ADMIN_PASSWORD` to
            protect this console.
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordGate;
