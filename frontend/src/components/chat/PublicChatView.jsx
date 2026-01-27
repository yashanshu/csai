import ChatPanel from "./ChatPanel.jsx";

const PublicChatView = ({
  chatPanelProps,
  title = "Chat",
  subtitle = "Ask anything. Your conversation is saved automatically.",
}) => {
  return (
    <main className="mt-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
            Public chat
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-base-content/60">{subtitle}</p>
        </div>
        <ChatPanel {...chatPanelProps} />
      </div>
    </main>
  );
};

export default PublicChatView;
