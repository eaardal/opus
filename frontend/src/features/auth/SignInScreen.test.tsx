import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Stub the services/container so we don't pull in Firebase at test time.
// `vi.hoisted` ensures `signIn` exists before vi.mock's factory runs.
const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("../../services/container", () => ({
  authService: {
    currentUser: () => null,
    onAuthChange: () => () => {},
    signIn,
    signOut: vi.fn(),
  },
  workspaceService: {},
}));

// Imported AFTER the mock so the mock is in effect.
import { SignInScreen } from "./SignInScreen";

beforeEach(() => {
  signIn.mockReset();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("SignInScreen", () => {
  test("renders the title, subtitle, and the Sign in button in the idle state", () => {
    render(<SignInScreen />);
    expect(screen.getByText("Domino")).toBeTruthy();
    expect(screen.getByText("Sign in to continue")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Sign in with Google" });
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  test("forces the document into light mode on mount", () => {
    render(<SignInScreen />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  test("disables the button and shows 'Signing in…' while signIn is pending", async () => {
    let resolveSignIn: () => void = () => {};
    signIn.mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveSignIn = res;
        }),
    );

    render(<SignInScreen />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Signing in…")).toBeTruthy();
    });
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);

    resolveSignIn();
  });

  test("renders the error message when signIn rejects", async () => {
    signIn.mockRejectedValueOnce(new Error("Bad email"));
    render(<SignInScreen />);
    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("Bad email")).toBeTruthy();
    // Button should be re-enabled after a failed attempt.
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });

  test("matches snapshot in the idle state", () => {
    const { container } = render(<SignInScreen />);
    expect(container.querySelector(".signin-screen")).toMatchSnapshot();
  });
});
