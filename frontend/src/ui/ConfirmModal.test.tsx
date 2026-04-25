import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ConfirmHost, confirm } from "./ConfirmModal";

describe("ConfirmHost + confirm()", () => {
  test("renders the title, message, and default button labels when a confirm is pending", async () => {
    const { findByText, getByText } = render(<ConfirmHost />);
    const result = confirm({ title: "Delete?", message: "This cannot be undone." });

    await findByText("Delete?");
    expect(getByText("This cannot be undone.")).toBeTruthy();
    expect(getByText("Cancel")).toBeTruthy();
    expect(getByText("Confirm")).toBeTruthy();

    fireEvent.click(getByText("Cancel"));
    expect(await result).toBe(false);
  });

  test("uses custom confirmLabel/cancelLabel when provided", async () => {
    const { findByText } = render(<ConfirmHost />);
    const result = confirm({
      title: "Sign out",
      message: "Sure?",
      confirmLabel: "Sign out",
      cancelLabel: "Stay",
    });
    fireEvent.click(await findByText("Stay"));
    expect(await result).toBe(false);
  });

  test("Confirm button resolves the promise to true", async () => {
    const { findByText } = render(<ConfirmHost />);
    const result = confirm({ title: "Apply", message: "Proceed?" });
    fireEvent.click(await findByText("Confirm"));
    expect(await result).toBe(true);
  });

  test("Enter resolves to true", async () => {
    const { findByText } = render(<ConfirmHost />);
    const result = confirm({ title: "Enter test", message: "x" });
    await findByText("Enter test");
    fireEvent.keyDown(window, { key: "Enter" });
    expect(await result).toBe(true);
  });

  test("Escape resolves to false", async () => {
    const { findByText } = render(<ConfirmHost />);
    const result = confirm({ title: "Escape test", message: "x" });
    await findByText("Escape test");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await result).toBe(false);
  });

  test("clicking the overlay (outside the dialog) resolves to false", async () => {
    const { container, findByText } = render(<ConfirmHost />);
    const result = confirm({ title: "Outside", message: "x" });
    await findByText("Outside");
    fireEvent.click(container.querySelector(".confirm-overlay") as HTMLElement);
    expect(await result).toBe(false);
  });

  test("matches snapshot for a typical destructive confirm", async () => {
    const { container, findByText } = render(<ConfirmHost />);
    const result = confirm({
      title: "Delete workspace",
      message: "This permanently removes everything in it.",
      confirmLabel: "Delete",
    });
    await findByText("Delete workspace");
    expect(container.querySelector(".confirm-overlay")).toMatchSnapshot();
    fireEvent.keyDown(window, { key: "Escape" });
    await result;
  });

  test("waits until ConfirmHost has registered before showing", async () => {
    // Sanity check that confirm() awaits the host's mount effect.
    const { findByText } = render(<ConfirmHost />);
    await waitFor(() => {
      // The host should have replaced the impl at this point.
    });
    const result = confirm({ title: "Mounted", message: "" });
    await findByText("Mounted");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await result).toBe(false);
  });
});
