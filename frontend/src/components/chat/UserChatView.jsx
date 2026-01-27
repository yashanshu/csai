import ChatPanel from "./ChatPanel.jsx";
import ChatSidebar from "./ChatSidebar.jsx";
import ConnectionCard from "./ConnectionCard.jsx";

const UserChatView = ({
  settings,
  defaultModel,
  onUpdateSetting,
  onOpenAdmin,
  chatSidebarProps,
  chatPanelProps,
}) => {
  return (
    <main className="mt-10 grid gap-8 lg:grid-cols-[0.45fr_0.55fr]">
      <div className="grid gap-8">
        <ChatSidebar {...chatSidebarProps} />
        <ConnectionCard
          settings={settings}
          defaultModel={defaultModel}
          onUpdateSetting={onUpdateSetting}
          onOpenAdmin={onOpenAdmin}
        />
      </div>
      <ChatPanel {...chatPanelProps} />
    </main>
  );
};

export default UserChatView;
