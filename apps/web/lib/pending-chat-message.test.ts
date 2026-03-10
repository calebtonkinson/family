import { describe, expect, it, vi } from "vitest";
import {
  getPendingFiles,
  getPendingMessage,
  getPendingResearch,
  setPendingFiles,
  setPendingMessage,
  setPendingResearch,
} from "./pending-chat-message";

class FileReaderMock {
  result: string | ArrayBuffer | null = null;
  onload: ((event: { target: FileReaderMock }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,stub-${file.name}`;
    this.onload?.({ target: this });
  }
}

describe("pending chat message helpers", () => {
  it("round-trips and clears the pending message", () => {
    setPendingMessage("Plan dinners for this week");

    expect(getPendingMessage()).toBe("Plan dinners for this week");
    expect(getPendingMessage()).toBeNull();
  });

  it("round-trips and clears the pending research flag", () => {
    setPendingResearch(true);

    expect(getPendingResearch()).toBe(true);
    expect(getPendingResearch()).toBe(false);
  });

  it("serializes attached files into session storage", async () => {
    vi.stubGlobal("FileReader", FileReaderMock);

    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    await setPendingFiles([file]);

    expect(getPendingFiles()).toEqual([
      {
        type: "file",
        url: "data:text/plain;base64,stub-notes.txt",
        mediaType: "text/plain",
        filename: "notes.txt",
      },
    ]);
    expect(getPendingFiles()).toBeNull();
  });
});
