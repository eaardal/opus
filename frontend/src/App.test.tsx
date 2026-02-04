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

import { ConfirmDialog, OpenFile, SaveFile, SaveFileAs } from "../wailsjs/go/main/App";

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

  describe("Opening files", () => {
    it("should call OpenFile when clicking Open button", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof OpenFile>>);

      render(<App />);

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      expect(OpenFile).toHaveBeenCalled();
    });

    it("should load tasks from opened file", async () => {
      const user = userEvent.setup();
      const fileContent = {
        tasks: [
          { id: "1", text: "Task from file", x: 100, y: 100, status: "pending" },
          { id: "2", text: "Another task", x: 200, y: 200, status: "completed" },
        ],
        connections: [],
      };
      vi.mocked(OpenFile).mockResolvedValue({
        content: JSON.stringify(fileContent),
        filePath: "/path/to/file.json",
      });

      render(<App />);

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Task from file")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Another task")).toBeInTheDocument();
      });
    });

    it("should display file name after opening", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockResolvedValue({
        content: JSON.stringify({ tasks: [], connections: [] }),
        filePath: "/path/to/my-project.json",
      });

      render(<App />);

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByText("my-project.json")).toBeInTheDocument();
      });
    });

    it("should not change state if OpenFile returns null", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof OpenFile>>);

      render(<App />);

      // Add a task first
      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);
      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "Existing task");

      // Try to open (but cancel)
      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      // Original task should still be there
      expect(screen.getByDisplayValue("Existing task")).toBeInTheDocument();
    });

    it("should load connections from opened file", async () => {
      const user = userEvent.setup();
      const fileContent = {
        tasks: [
          { id: "a", text: "Task A", x: 0, y: 0, status: "pending" },
          { id: "b", text: "Task B", x: 100, y: 100, status: "pending" },
        ],
        connections: [{ from: "a", to: "b" }],
      };
      vi.mocked(OpenFile).mockResolvedValue({
        content: JSON.stringify(fileContent),
        filePath: "/path/to/file.json",
      });

      render(<App />);

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Task A")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Task B")).toBeInTheDocument();
      });

      // Save and verify connections were loaded (saved data should include the connection)
      let savedData: string | null = null;
      vi.mocked(SaveFile).mockImplementation(async (_path: string, data: string) => {
        savedData = data;
      });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(savedData).not.toBeNull();
        const parsed = JSON.parse(savedData!);
        expect(parsed.connections).toHaveLength(1);
        expect(parsed.connections[0]).toEqual({ from: "a", to: "b" });
      });
    });

    it("should not update state when OpenFile throws", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockRejectedValue(new Error("File read failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);
      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "Task before error");

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Task before error")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it("should not update state when file content is invalid JSON", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockResolvedValue({
        content: "not valid json {",
        filePath: "/path/to/bad.json",
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<App />);

      // Add a task first so we can verify state is preserved
      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);
      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "Task before invalid open");

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(OpenFile).toHaveBeenCalled();
      });

      // State should be unchanged: our task should still be there
      expect(screen.getByDisplayValue("Task before invalid open")).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe("Saving files", () => {
    it("should call SaveFileAs when saving without a file path", async () => {
      const user = userEvent.setup();
      vi.mocked(SaveFileAs).mockResolvedValue("/path/to/new-file.json");

      render(<App />);

      // Add a task to have something to save
      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(SaveFileAs).toHaveBeenCalled();
      });
    });

    it("should call SaveFile when saving with an existing file path", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockResolvedValue({
        content: JSON.stringify({ tasks: [], connections: [] }),
        filePath: "/path/to/existing.json",
      });
      vi.mocked(SaveFile).mockResolvedValue(undefined);

      render(<App />);

      // Open a file first to set the file path
      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByText("existing.json")).toBeInTheDocument();
      });

      // Add a task
      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      // Save
      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(SaveFile).toHaveBeenCalledWith(
          "/path/to/existing.json",
          expect.any(String)
        );
      });
    });

    it("should save tasks and connections as JSON", async () => {
      const user = userEvent.setup();
      let savedData: string | null = null;
      vi.mocked(SaveFileAs).mockImplementation(async (data: string) => {
        savedData = data;
        return "/path/to/file.json";
      });

      render(<App />);

      // Add a task
      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);
      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, "Test task");

      // Save
      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(savedData).not.toBeNull();
        const parsed = JSON.parse(savedData!);
        expect(parsed.tasks).toHaveLength(1);
        expect(parsed.tasks[0].text).toBe("Test task");
        expect(parsed.connections).toEqual([]);
      });
    });

    it("should display file name after SaveFileAs", async () => {
      const user = userEvent.setup();
      vi.mocked(SaveFileAs).mockResolvedValue("/documents/saved-file.json");

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText("saved-file.json")).toBeInTheDocument();
      });
    });

    it("should not set file path if SaveFileAs is cancelled", async () => {
      const user = userEvent.setup();
      vi.mocked(SaveFileAs).mockResolvedValue("");

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(SaveFileAs).toHaveBeenCalled();
      });

      // No file name should be displayed
      expect(screen.queryByText(".json")).not.toBeInTheDocument();
    });

    it("should save with Cmd+S keyboard shortcut", async () => {
      const user = userEvent.setup();
      vi.mocked(SaveFileAs).mockResolvedValue("/path/to/file.json");

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      await user.keyboard("{Meta>}s{/Meta}");

      await waitFor(() => {
        expect(SaveFileAs).toHaveBeenCalled();
      });
    });

    it("should save with Ctrl+S keyboard shortcut", async () => {
      const user = userEvent.setup();
      vi.mocked(SaveFileAs).mockResolvedValue("/path/to/file.json");

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      await user.keyboard("{Control>}s{/Control}");

      await waitFor(() => {
        expect(SaveFileAs).toHaveBeenCalled();
      });
    });

    it("should use SaveFile (not SaveFileAs) when saving again after SaveFileAs", async () => {
      const user = userEvent.setup();
      vi.mocked(SaveFileAs).mockResolvedValue("/path/to/first-save.json");
      vi.mocked(SaveFile).mockResolvedValue(undefined);

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(SaveFileAs).toHaveBeenCalledTimes(1);
        expect(screen.getByText("first-save.json")).toBeInTheDocument();
      });

      // Change content and save again
      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, " updated");

      await user.click(saveButton);

      await waitFor(() => {
        expect(SaveFile).toHaveBeenCalledWith(
          "/path/to/first-save.json",
          expect.any(String)
        );
        expect(SaveFileAs).toHaveBeenCalledTimes(1);
      });
    });

    it("should not set file path when SaveFileAs throws", async () => {
      const user = userEvent.setup();
      vi.mocked(SaveFileAs).mockRejectedValue(new Error("Save failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(SaveFileAs).toHaveBeenCalled();
      });

      // File path should not be set (no file name displayed); task still present
      expect(screen.queryByText(/\.json$/)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter task...")).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it("should not clear unsaved indicator when SaveFile throws", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockResolvedValue({
        content: JSON.stringify({ tasks: [], connections: [] }),
        filePath: "/path/to/doc.json",
      });
      vi.mocked(SaveFile).mockRejectedValue(new Error("Write failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<App />);

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByText("doc.json")).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("●")).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(SaveFile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText("●")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Unsaved changes indicator", () => {
    it("should show unsaved indicator when file is open and there are changes", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockResolvedValue({
        content: JSON.stringify({ tasks: [], connections: [] }),
        filePath: "/path/to/file.json",
      });

      render(<App />);

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByText("file.json")).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("●")).toBeInTheDocument();
      });
    });

    it("should hide unsaved indicator after saving", async () => {
      const user = userEvent.setup();
      vi.mocked(SaveFileAs).mockResolvedValue("/path/to/file.json");
      vi.mocked(SaveFile).mockResolvedValue(undefined);

      render(<App />);

      const addButton = screen.getByRole("button", { name: /add task/i });
      await user.click(addButton);

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText("file.json")).toBeInTheDocument();
      });

      // Make a change so unsaved indicator appears
      const taskInput = screen.getByPlaceholderText("Enter task...");
      await user.type(taskInput, " updated");

      await waitFor(() => {
        expect(screen.getByText("●")).toBeInTheDocument();
      });

      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByText("●")).not.toBeInTheDocument();
      });
    });

    it("should not show unsaved indicator after opening an empty file", async () => {
      const user = userEvent.setup();
      vi.mocked(OpenFile).mockResolvedValue({
        content: JSON.stringify({ tasks: [], connections: [] }),
        filePath: "/path/to/file.json",
      });

      render(<App />);

      const openButton = screen.getByRole("button", { name: /^open$/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByText("file.json")).toBeInTheDocument();
      });

      expect(screen.queryByText("●")).not.toBeInTheDocument();
    });
  });
});
