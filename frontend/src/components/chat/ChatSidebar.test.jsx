import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, vi } from "vitest";

import ChatSidebar from "./ChatSidebar.jsx";

test("renders chat threads and triggers selection", async () => {
  const onSelectChat = vi.fn();
  const onStartNewChat = vi.fn();

  render(
    <ChatSidebar
      firestoreStatus="Connected"
      firestoreTone="badge-success"
      firestoreError=""
      chatThreads={[
        { id: "chat-1", title: "First chat", updatedAt: new Date(), lastMessage: "Hello" },
        { id: "chat-2", title: "Second chat", updatedAt: new Date(), lastMessage: "Hi" },
      ]}
      activeChatId="chat-1"
      onSelectChat={onSelectChat}
      onStartNewChat={onStartNewChat}
      hasFirestore
    />
  );

  expect(screen.getByText("Conversations")).toBeInTheDocument();
  expect(screen.getByText("First chat")).toBeInTheDocument();
  expect(screen.getByText("Second chat")).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(screen.getByText("Second chat"));

  expect(onSelectChat).toHaveBeenCalledWith("chat-2");
});
