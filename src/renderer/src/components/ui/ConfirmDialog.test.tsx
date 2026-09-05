import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ConfirmProvider, useConfirm } from "./ConfirmDialog";

function TestConsumer() {
  const confirm = useConfirm();
  return (
    <div>
      <button type="button" onClick={() => confirm({ message: "Delete?" })}>
        open
      </button>
      <button type="button" onClick={() => confirm({ message: "Remove?", variant: "danger" })}>
        danger
      </button>
    </div>
  );
}

describe("ConfirmDialog", () => {
  it("does not render when closed", () => {
    render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with default title and labels", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>,
    );

    await user.click(screen.getByText("open"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Delete?")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders danger variant styling", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>,
    );

    await user.click(screen.getByText("danger"));
    const dialog = screen.getByRole("dialog");
    const confirmBtn = within(dialog).getByRole("button", { name: "Confirm" });
    expect(confirmBtn).toHaveClass("btn-danger");
  });

  it("closes when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>,
    );

    await user.click(screen.getByText("open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", () => {
    render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByText("open"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "a" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>,
    );

    await user.click(screen.getByText("open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const backdrop = document.querySelector('[class*="fixed inset-0"]');
    expect(backdrop).toBeTruthy();
    await user.click(backdrop!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
