import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// Mock Wails runtime functions
vi.mock("../wailsjs/go/main/App", () => ({
  ConfirmDialog: vi.fn(),
  OpenFile: vi.fn(),
  SaveFile: vi.fn(),
  SaveFileAs: vi.fn(),
}));

import { ConfirmDialog } from "../wailsjs/go/main/App";

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Adding tasks", () => {
    it("should add a new task when clicking the Add Task button", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const taskInputs = screen.getAllByPlaceholderText("Enter task...");
      expect(taskInputs).toHaveLength(1);
    });

    it("should add multiple tasks", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);
      await user.click(addButton);
      await user.click(addButton);

      const taskInputs = screen.getAllByPlaceholderText("Enter task...");
      expect(taskInputs).toHaveLength(3);
    });

    it("should focus the input field of the newly added task", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const taskInput = screen.getByPlaceholderText("Enter task...");
      expect(taskInput).toHaveFocus();
    });

    it("should allow typing text into a task", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "My new task");

      expect(taskInput).toHaveValue("My new task");
    });

    it("should add a new task when pressing Cmd+Enter in task input", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "First task");
      await user.keyboard("{Meta>}{Enter}{/Meta}");

      const taskInputs = screen.getAllByPlaceholderText("Enter task...");
      expect(taskInputs).toHaveLength(2);
    });
  });

  describe("Removing tasks", () => {
    it("should remove a task when delete is confirmed", async () => {
      const user = userEvent.setup();
      vi.mocked(ConfirmDialog).mockResolvedValue(true);

      render(<App />);

      // Add a task
      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "Task to delete");

      // Delete the task
      const deleteButton = screen.getByRole("button", { name: "×" });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Enter task...")).not.toBeInTheDocument();
      });
    });

    it("should not remove a task when delete is cancelled", async () => {
      const user = userEvent.setup();
      vi.mocked(ConfirmDialog).mockResolvedValue(false);

      render(<App />);

      // Add a task
      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "Task to keep");

      // Try to delete the task
      const deleteButton = screen.getByRole("button", { name: "×" });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter task...")).toBeInTheDocument();
      });
    });

    it("should call ConfirmDialog with task name when deleting", async () => {
      const user = userEvent.setup();
      vi.mocked(ConfirmDialog).mockResolvedValue(false);

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "Important task");

      const deleteButton = screen.getByRole("button", { name: "×" });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(ConfirmDialog).toHaveBeenCalledWith(
          "Delete Task",
          'Delete "Important task"?'
        );
      });
    });
  });

  describe("Setting category", () => {
    it("should open the menu when clicking the menu button", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      expect(screen.getByText("Category")).toBeInTheDocument();
      expect(screen.getByText("Backend")).toBeInTheDocument();
      expect(screen.getByText("Frontend")).toBeInTheDocument();
      expect(screen.getByText("UX")).toBeInTheDocument();
    });

    it("should set category when clicking a category option", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      const backendOption = screen.getByRole("button", { name: /backend/i });
      await user.click(backendOption);

      // Menu should close after selection
      expect(screen.queryByText("Category")).not.toBeInTheDocument();

      // Re-open menu to verify category is set
      await user.click(menuButton);
      const backendButton = screen.getByRole("button", { name: /backend/i });
      expect(backendButton).toHaveClass("active");
    });

    it("should show clear category option when category is set", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      const frontendOption = screen.getByRole("button", { name: /frontend/i });
      await user.click(frontendOption);

      await user.click(menuButton);
      expect(screen.getByText("Clear category")).toBeInTheDocument();
    });

    it("should clear category when clicking clear category", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      const uxOption = screen.getByRole("button", { name: /^ux$/i });
      await user.click(uxOption);

      await user.click(menuButton);
      const clearButton = screen.getByRole("button", { name: /clear category/i });
      await user.click(clearButton);

      await user.click(menuButton);
      expect(screen.queryByText("Clear category")).not.toBeInTheDocument();
    });
  });

  describe("Setting status", () => {
    it("should show status options in the menu", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(screen.getByText("In Progress")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Archived")).toBeInTheDocument();
    });

    it("should have Pending as default status", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      const pendingButton = screen.getByRole("button", { name: /pending/i });
      expect(pendingButton).toHaveClass("active");
    });

    it("should set status to In Progress when clicked", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      const inProgressOption = screen.getByRole("button", { name: /in progress/i });
      await user.click(inProgressOption);

      // Menu should close after selection
      expect(screen.queryByText("Status")).not.toBeInTheDocument();

      // Re-open menu to verify status is set
      await user.click(menuButton);
      const inProgressButton = screen.getByRole("button", { name: /in progress/i });
      expect(inProgressButton).toHaveClass("active");
    });

    it("should set status to Completed when clicked", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      const completedOption = screen.getByRole("button", { name: /completed/i });
      await user.click(completedOption);

      await user.click(menuButton);
      const completedButton = screen.getByRole("button", { name: /completed/i });
      expect(completedButton).toHaveClass("active");
    });

    it("should set status to Archived when clicked", async () => {
      const user = userEvent.setup();
      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const menuButton = screen.getByRole("button", { name: "⋯" });
      await user.click(menuButton);

      const archivedOption = screen.getByRole("button", { name: /archived/i });
      await user.click(archivedOption);

      await user.click(menuButton);
      const archivedButton = screen.getByRole("button", { name: /archived/i });
      expect(archivedButton).toHaveClass("active");
    });
  });
});
