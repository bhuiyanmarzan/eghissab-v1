import {
  fireEvent,
  render,
  screen,
  within,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvoiceDashboardPage } from "./InvoiceDashboardPage";
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    children,
  AreaChart: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
  PieChart: () => null,
  Pie: () => null,
}));
afterEach(cleanup);
const renderPage = () =>
  render(
    <MemoryRouter>
      <InvoiceDashboardPage />
    </MemoryRouter>,
  );
describe("invoice dashboard", () => {
  it("switches the selected summary and chart", () => {
    renderPage();
    const paid = screen.getByRole("button", { name: /Paid.*-8.73/ });
    fireEvent.click(paid);
    expect(paid).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("img", { name: "Paid invoices by month" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Total.*20.3/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
  it("filters invoice status, searches and opens the matching invoice", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Jenny Jones")).toBeInTheDocument();
    expect(within(dialog).queryByText("David Jones")).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "missing" },
    });
    expect(within(dialog).getByText("No invoices found")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "790842" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "#790842" }));
    expect(
      within(dialog).getByRole("heading", { name: "Invoice #790842" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Amount: $182.89")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close invoice dialog" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("opens notification details and links to the existing notification page", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Johnny sent/ }));
    expect(
      within(screen.getByRole("dialog")).getByRole("link", {
        name: "View All Notifications",
      }),
    ).toHaveAttribute("href", "/notifications");
  });
  it("opens all invoices from View All and prints an invoice preview", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "View All" }));
    expect(within(screen.getByRole("dialog")).getAllByRole("row")).toHaveLength(
      6,
    );
    fireEvent.click(screen.getByRole("button", { name: "#790841" }));
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
