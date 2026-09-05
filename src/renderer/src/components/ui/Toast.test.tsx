import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function TestConsumer() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.showToast("success msg", "success")}>
        success
      </button>
      <button type="button" onClick={() => toast.showToast("error msg", "error")}>
        error
      </button>
      <button type="button" onClick={() => toast.showToast("info msg")}>
        info
      </button>
      <ul data-testid="toasts">
        {toast.toasts.map((t) => (
          <li key={t.id}>{t.message}</li>
        ))}
      </ul>
    </div>
  );
}

describe("Toast", () => {
  it("renders a toast when showToast is called", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("success"));
    const toastContainer = screen.getByRole("status");
    expect(within(toastContainer).getByText("success msg")).toBeInTheDocument();
  });

  it("applies the correct variant class", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("error"));
    const toastContainer = screen.getByRole("status");
    expect(toastContainer).toHaveClass("text-red-400");
  });

  it("defaults to info variant", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("info"));
    const toastContainer = screen.getByRole("status");
    expect(toastContainer).toHaveClass("text-[var(--color-text)]");
  });

  it("dismisses immediately when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("info"));
    const toastContainer = screen.getByRole("status");
    expect(within(toastContainer).getByText("info msg")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Dismiss notification"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
