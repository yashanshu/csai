import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, test, vi } from "vitest";

import App from "./App.jsx";

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
  mockUseFirestoreChat.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  expect(screen.getByText("Conversations")).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);

  expect(screen.getByText("Admin settings")).toBeInTheDocument();
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

  expect(screen.getByText("Public chat")).toBeInTheDocument();
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
  await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);

  await user.type(
    screen.getByLabelText("Admin Secret"),
    "super-secret"
  );

  await user.click(screen.getByRole("button", { name: "Generate key" }));

  const generated = await screen.findByText("new-key");
  expect(generated).toBeInTheDocument();

  expect(fetchSpy).toHaveBeenCalled();
  const [url, options] = fetchSpy.mock.calls[0];
  expect(url.toString()).toContain("/admin/generate-key");
  expect(options.method).toBe("POST");
  expect(options.headers["Admin-Secret"]).toBe("super-secret");
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
  await user.type(screen.getByLabelText("API Key"), "user-key");
  await user.type(screen.getByLabelText("Your message"), "Hi assistant");

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
  await user.type(screen.getByLabelText("API Key"), "user-key");
  await user.click(screen.getByRole("button", { name: "Image" }));
  await user.type(screen.getByLabelText("Describe the image"), "A neon skyline");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(sendImage).toHaveBeenCalled();
  expect(sendMessage).not.toHaveBeenCalled();
});
