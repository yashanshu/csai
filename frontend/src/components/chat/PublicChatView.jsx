import ChatPanel from "./ChatPanel.jsx";
import ChatSidebar from "./ChatSidebar.jsx";

const PublicChatView = ({
  chatPanelProps,
  chatSidebarProps,
  title = "CS AI",
  subtitle = "Collaborate with your assistant in a clean, focused workspace.",
}) => {
  return (
    <main className="mt-6 grid gap-6 lg:grid-cols-[0.3fr_0.7fr]">
      <aside className="space-y-5">
        <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
            Public chat
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <ChatSidebar {...chatSidebarProps} variant="public" />
      </aside>
      <ChatPanel {...chatPanelProps} variant="public" />
    </main>
  );
};

export default PublicChatView;
