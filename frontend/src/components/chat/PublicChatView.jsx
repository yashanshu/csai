import ChatPanel from "./ChatPanel.jsx";
import ChatSidebar from "./ChatSidebar.jsx";

const PublicChatView = ({ chatPanelProps, chatSidebarProps }) => {
  return (
    <main className="flex min-h-[78vh] w-full flex-col gap-6 lg:flex-row">
      <ChatSidebar {...chatSidebarProps} />
      <div className="flex min-h-[78vh] flex-1 flex-col">
        <ChatPanel {...chatPanelProps} />
      </div>
    </main>
  );
};

export default PublicChatView;
