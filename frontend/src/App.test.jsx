import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, test, vi } from "vitest";

import App from "./App.jsx";
import { ADMIN_PASSWORD } from "./config/appConfig.js";

const mockUseFirestoreChat = vi.fn();

vi.mock("./hooks/useFirestoreChat.js", () => ({
  useFirestoreChat: (...args) => mockUseFirestoreChat(...args),
}));

const mockFetch = (payload) =>
  vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      "content-type": "application/json",
      "x-request-id": "req-1",
    }),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockUseFirestoreChat.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const unlockIfNeeded = async (user) => {
  if (!ADMIN_PASSWORD) {
    return;
  }
  const passwordInput = screen.queryByLabelText("Password");
  if (!passwordInput) {
    return;
  }
  await user.type(passwordInput, ADMIN_PASSWORD);
  await user.click(screen.getByRole("button", { name: "Unlock" }));
};

test("switches from user chat to admin view", async () => {
  mockUseFirestoreChat.mockReturnValue({
    firestoreDb: {},
    firestoreStatus: "Connected",
    firestoreError: "",
    chatThreads: [],
    activeChatId: "",
    activeChat: null,
    chatMessages: [],
    chatStatus: "Idle",
    chatError: "",
    chatRequestId: "",
    isChatLoading: false,
    startNewChat: vi.fn(),
    selectChat: vi.fn(),
    sendMessage: vi.fn(),
    sendImage: vi.fn(),
  });

  render(<App />);

  const user = userEvent.setup();
  await unlockIfNeeded(user);

  expect(screen.getByText("History")).toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);

  expect(screen.getByText("Admin Console")).toBeInTheDocument();
});

test("public chat route hides admin tabs", async () => {
  mockUseFirestoreChat.mockReturnValue({
    firestoreDb: {},
    firestoreStatus: "Connected",
    firestoreError: "",
    chatThreads: [],
    activeChatId: "",
    activeChat: null,
    chatMessages: [],
    chatStatus: "Idle",
    chatError: "",
    chatRequestId: "",
    isChatLoading: false,
    startNewChat: vi.fn(),
    selectChat: vi.fn(),
    sendMessage: vi.fn(),
    sendImage: vi.fn(),
  });

  window.history.pushState({}, "", "/chat");

  render(<App />);

  expect(screen.getByText("CS AI Console")).toBeInTheDocument();
  expect(screen.queryByText("Admin")).not.toBeInTheDocument();

  window.history.pushState({}, "", "/");
});

test("generate key calls admin endpoint and shows result", async () => {
  const fetchSpy = mockFetch({ api_key: "new-key", status: "created" });
  vi.stubGlobal("fetch", fetchSpy);

  mockUseFirestoreChat.mockReturnValue({
    firestoreDb: {},
    firestoreStatus: "Connected",
    firestoreError: "",
    chatThreads: [],
    activeChatId: "",
    activeChat: null,
    chatMessages: [],
    chatStatus: "Idle",
    chatError: "",
    chatRequestId: "",
    isChatLoading: false,
    startNewChat: vi.fn(),
    selectChat: vi.fn(),
    sendMessage: vi.fn(),
    sendImage: vi.fn(),
  });

  render(<App />);

  const user = userEvent.setup();
  await unlockIfNeeded(user);
  await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);

  await user.click(screen.getByRole("button", { name: "Settings" }));
  const adminSecretInput = screen.queryByLabelText("Admin Secret");
  if (adminSecretInput) {
    await user.type(adminSecretInput, "super-secret");
  }

  await user.click(screen.getByRole("button", { name: "API Keys" }));

  await user.click(screen.getByRole("button", { name: "Generate key" }));

  const generated = await screen.findByText("new-key");
  expect(generated).toBeInTheDocument();

  expect(fetchSpy).toHaveBeenCalled();
  const [url, options] = fetchSpy.mock.calls[0];
  expect(url.toString()).toContain("/admin/generate-key");
  expect(options.method).toBe("POST");
  const expectedSecret = ADMIN_PASSWORD || "super-secret";
  expect(options.headers["Admin-Secret"]).toBe(expectedSecret);
});

test("sends chat content through chat hook", async () => {
  const sendMessage = vi.fn();
  const sendImage = vi.fn();
  mockUseFirestoreChat.mockReturnValue({
    firestoreDb: {},
    firestoreStatus: "Connected",
    firestoreError: "",
    chatThreads: [],
    activeChatId: "",
    activeChat: null,
    chatMessages: [],
    chatStatus: "Idle",
    chatError: "",
    chatRequestId: "",
    isChatLoading: false,
    startNewChat: vi.fn(),
    selectChat: vi.fn(),
    sendMessage,
    sendImage,
  });

  render(<App />);

  const user = userEvent.setup();
  await unlockIfNeeded(user);
  await user.type(screen.getByLabelText("API Key"), "user-key");
  await user.type(screen.getByLabelText("Chat input"), "Hi assistant");

  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendMessage).toHaveBeenCalledWith("Hi assistant");
});

test("image mode sends image request", async () => {
  const sendMessage = vi.fn();
  const sendImage = vi.fn();
  mockUseFirestoreChat.mockReturnValue({
    firestoreDb: {},
    firestoreStatus: "Connected",
    firestoreError: "",
    chatThreads: [],
    activeChatId: "",
    activeChat: null,
    chatMessages: [],
    chatStatus: "Idle",
    chatError: "",
    chatRequestId: "",
    isChatLoading: false,
    startNewChat: vi.fn(),
    selectChat: vi.fn(),
    sendMessage,
    sendImage,
  });

  render(<App />);

  const user = userEvent.setup();
  await unlockIfNeeded(user);
  await user.type(screen.getByLabelText("API Key"), "user-key");
  await user.click(screen.getByRole("button", { name: "Image" }));
  await user.type(screen.getByLabelText("Chat input"), "A neon skyline");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendImage).toHaveBeenCalled();
  expect(sendMessage).not.toHaveBeenCalled();
});
