import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../shared/types";
import { formatChatExport } from "../chat-export";

const USER_MSG: ChatMessage = {
  id: "1",
  role: "user",
  text: "Hello",
  timestamp: 12345,
};

const ASSISTANT_MSG: ChatMessage = {
  id: "2",
  role: "assistant",
  text: "Hi there",
  timestamp: 12346,
  provider: "gemini",
};

describe("formatChatExport (pure, no Electron mock)", () => {
  it("should render markdown with user and assistant sections", () => {
    const result = formatChatExport([USER_MSG, ASSISTANT_MSG], "markdown");

    expect(result).toContain("# Gaming Copilot Chat History");
    expect(result).toContain("## User");
    expect(result).toContain("Hello");
    expect(result).toContain("## Assistant");
    expect(result).toContain("Hi there");
  });

  it("should include the provider tag for assistant messages", () => {
    const result = formatChatExport([ASSISTANT_MSG], "markdown");

    expect(result).toContain("· gemini");
  });

  it("should omit the provider tag when absent", () => {
    const result = formatChatExport([{ ...ASSISTANT_MSG, provider: undefined }], "markdown");

    expect(result).not.toContain("·");
  });

  it("should render an empty transcript as header only", () => {
    expect(formatChatExport([], "markdown")).toBe("# Gaming Copilot Chat History\n\n");
  });

  it("should serialize messages as pretty-printed JSON", () => {
    const messages = [USER_MSG, ASSISTANT_MSG];
    const result = formatChatExport(messages, "json");

    expect(JSON.parse(result)).toEqual(JSON.parse(JSON.stringify(messages)));
  });
});
