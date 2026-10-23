import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  CircleX,
  Download,
  EllipsisVertical,
  FileText,
  Hourglass,
  Link2,
  Receipt,
  Settings,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
} from "../components/ui/primitives";
import { chartTick, translateNode, translateString } from "../lib/localization";

const summaries = [
  {
    name: "Total",
    change: "20.3",
    count: 3,
    color: "#faad14",
    values: [20, 45, 45, 70, 45, 60, 50, 60, 55, 85, 78, 90],
  },
  {
    name: "Paid",
    change: "-8.73",
    count: 5,
    color: "#ff4d4f",
    values: [12, 18, 15, 17, 12, 10, 14, 16, 25, 17, 20, 8],
  },
  {
    name: "Pending",
    change: "1.73",
    count: 20,
    color: "#52c41a",
    values: [10, 15, 12, 18, 15, 20, 16, 22, 18, 25, 20, 28],
  },
  {
    name: "Overdue",
    change: "-4.7",
    count: 5,
    color: "#1677ff",
    values: [5, 10, 8, 12, 7, 10, 6, 9, 12, 7, 10, 5],
  },
];
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const invoices = [
  {
    id: "790841",
    name: "David Jones",
    amount: 329.2,
    time: "5 min ago",
    status: "Paid",
  },
  {
    id: "790842",
    name: "Jenny Jones",
    amount: 182.89,
    time: "1 day ago",
    status: "Pending",
  },
  {
    id: "790843",
    name: "Harry Ben",
    amount: 320,
    time: "3 week ago",
    status: "Overdue",
  },
  {
    id: "790844",
    name: "Jenifer Vintage",
    amount: 182.89,
    time: "3 week ago",
    status: "Cancelled",
  },
  {
    id: "790845",
    name: "Stebin Ben",
    amount: 324,
    time: "1 month ago",
    status: "Draft",
  },
];
const expenses = [
  { name: "Pending", value: 3202, color: "#faad14" },
  { name: "Paid", value: 45050, color: "#52c41a" },
  { name: "Overdue", value: 25000, color: "#1677ff" },
  { name: "Draft", value: 7694, color: "#13c2c2" },
];
const shortcuts = [
  { name: "All Invoices", icon: FileText, color: "#1677ff" },
  { name: "Reports", icon: Receipt, color: "#13c2c2" },
  { name: "Paid", icon: CircleDollarSign, color: "#52c41a" },
  { name: "Pending", icon: Hourglass, color: "#faad14" },
  { name: "Cancelled", icon: CircleX, color: "#ff4d4f" },
  { name: "Draft", icon: ShoppingBag, color: "#1677ff" },
];
const notices = [
  {
    text: "Johnny sent you an invoice billed $1,000.",
    time: "2 August",
    icon: Download,
  },
  {
    text: "Sent an invoice to Aida Bugg amount of $200.",
    time: "7 hours ago",
    icon: FileText,
  },
  {
    text: "There was a failure to your setup",
    time: "7 hours ago",
    icon: Settings,
  },
  {
    text: "Cristina Danny invited you to join Meeting",
    time: "7 hours ago",
    icon: Receipt,
  },
  {
    text: "Cristina Danny invited you to join Meeting",
    time: "7 hours ago",
    icon: Receipt,
  },
];
const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Actions({
  name,
  onMessage,
}: {
  name: string;
  onMessage: (text: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={translateString(`${name} actions`)}
        >
          <EllipsisVertical className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-[100] min-w-32 rounded border border-border bg-surface p-1 text-ink shadow-lg"
        >
          <DropdownMenu.Item
            className="cursor-pointer rounded px-3 py-2 text-sm outline-none focus:bg-subtle"
            onSelect={() => window.print()}
          >
            {translateNode("Print")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cursor-pointer rounded px-3 py-2 text-sm outline-none focus:bg-subtle"
            onSelect={() => {
              navigator.clipboard
                ?.writeText(window.location.href)
                .then(() => onMessage("Dashboard link copied"))
                .catch(() =>
                  onMessage(
                    "Unable to copy the link. Copy the address from your browser.",
                  ),
                );
              if (!navigator.clipboard)
                onMessage(
                  "Copy the address from your browser to share this dashboard.",
                );
            }}
          >
            {translateNode("Share")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// The reference uses demonstration data. No invoice API is defined in this project yet.
export function InvoiceDashboardPage() {
  useTranslation();
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<(typeof invoices)[number] | null>(null);
  const [notice, setNotice] = useState<(typeof notices)[number] | null>(null);
  const [message, setMessage] = useState("");
  const visible = invoices.filter(
    (invoice) =>
      (filter === "All Invoices" || invoice.status === filter) &&
      `${invoice.name} ${invoice.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="invoice-dashboard space-y-5">
      <p className="text-xs text-muted">
        {translateNode("Sample invoice data")}
      </p>
      {message && (
        <div
          role="status"
          className="flex items-center justify-between rounded bg-primary-soft px-4 py-2 text-sm text-primary"
        >
          {translateNode(message)}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss message"
            onClick={() => setMessage("")}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
      <Card>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaries.map((summary, index) => (
              <button
                type="button"
                key={summary.name}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
                className={`rounded border border-border p-5 text-start outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected === index ? "bg-subtle" : "hover:bg-subtle"}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                  <strong>{translateNode(summary.name)}</strong>
                  <span className="flex items-center gap-1 text-muted">
                    {index === 2 ? (
                      <ChevronUp
                        className="size-3"
                        style={{ color: summary.color }}
                      />
                    ) : (
                      <ChevronDown
                        className="size-3"
                        style={{ color: summary.color }}
                      />
                    )}
                    {summary.change}%
                  </span>
                </div>
                <p className="font-semibold">£5678.09</p>
                <p className="mt-1 text-sm">
                  <strong>{summary.count}</strong>{" "}
                  <span className="text-muted">
                    {translateNode("invoices")}
                  </span>
                </p>
              </button>
            ))}
          </div>
          <div
            className="mt-7 h-[270px]"
            role="img"
            aria-label={translateString(
              `${summaries[selected].name} invoices by month`,
            )}
          >
            <ResponsiveContainer>
              <AreaChart
                data={summaries[selected].values.map((value, i) => ({
                  month: months[i],
                  value,
                }))}
                margin={{ left: -20, top: 20, right: 15, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="invoice-trend"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0" stopColor="#faad14" stopOpacity={0.12} />
                    <stop offset="1" stopColor="#faad14" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tickFormatter={chartTick}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tick={{ fontSize: 12, fill: "var(--color-muted)" }}
                />
                <YAxis
                  tickFormatter={chartTick}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tick={{ fontSize: 12, fill: "var(--color-muted)" }}
                />
                <Tooltip
                  labelFormatter={(value) => chartTick(String(value))}
                  formatter={(value) => [value, translateString("invoices")]}
                />
                <Area
                  type="linear"
                  dataKey="value"
                  stroke="#e5a329"
                  fill="url(#invoice-trend)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--color-surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
          {shortcuts.map(({ name, icon: Icon, color }) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                if (name === "Reports")
                  document
                    .getElementById("invoice-expenses")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                else {
                  setSearch("");
                  setFilter(name);
                }
              }}
              className="flex flex-col items-center gap-4 rounded border border-border px-3 py-5 text-sm text-muted hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                className="grid size-10 place-items-center rounded-full text-white"
                style={{ backgroundColor: color }}
              >
                <Icon className="size-5" />
              </span>
              {translateNode(name)}
            </button>
          ))}
        </CardContent>
      </Card>
      <div className="grid items-stretch gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Recent Invoice"
            action={<Actions name="Recent Invoice" onMessage={setMessage} />}
          />
          <div>
            {invoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => setDetail(invoice)}
                className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <Avatar name={invoice.name} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {invoice.name} -{" "}
                    <span className="text-muted">#{invoice.id}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {money(invoice.amount)}{" "}
                    <span className="ms-1">{translateNode(invoice.time)}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-border p-3 text-center">
            <Button
              variant="ghost"
              className="w-full text-primary"
              onClick={() => {
                setSearch("");
                setFilter("All Invoices");
              }}
            >
              {translateNode("View All")}
            </Button>
          </div>
        </Card>
        <Card id="invoice-expenses" tabIndex={-1}>
          <CardHeader
            title="Total Expenses"
            action={<Actions name="Total Expenses" onMessage={setMessage} />}
          />
          <CardContent>
            <div
              className="h-60"
              role="img"
              aria-label="Expenses by invoice status"
            >
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={expenses}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {expenses.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      money(Number(value)),
                      translateString(String(name)),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-6">
              {expenses.map((item) => (
                <div key={item.name}>
                  <p className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {translateNode(item.name)}
                  </p>
                  <p className="mt-1 ps-4 text-sm font-semibold">
                    ${item.value.toLocaleString("en-US")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="Notification"
            action={<Actions name="Notification" onMessage={setMessage} />}
          />
          <div>
            {notices.map((item, i) => (
              <button
                key={i}
                onClick={() => setNotice(item)}
                className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-start hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <item.icon className="size-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-xs font-medium leading-5">
                    {translateNode(item.text)}
                  </span>
                  <span className="block text-xs text-muted">
                    {translateNode(item.time)}
                  </span>
                </span>
                <Link2 className="size-3 shrink-0 text-muted" />
              </button>
            ))}
          </div>
          <div className="p-3 text-center">
            <Button asChild variant="ghost" className="w-full text-primary">
              <Link to="/notifications">{translateNode("View All")}</Link>
            </Button>
          </div>
        </Card>
      </div>
      <Dialog.Root
        open={filter !== null || detail !== null || notice !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFilter(null);
            setDetail(null);
            setNotice(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/45" />
          <Dialog.Content
            aria-describedby={undefined}
            className="invoice-dialog fixed left-1/2 top-1/2 z-[90] max-h-[85dvh] w-[650px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 text-ink shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold">
                {translateNode(
                  detail
                    ? `Invoice #${detail.id}`
                    : notice
                      ? "Notification"
                      : filter,
                )}
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close invoice dialog"
                >
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            {detail ? (
              <div className="space-y-4">
                <p className="font-semibold">{detail.name}</p>
                <Badge tone={detail.status === "Paid" ? "green" : "amber"}>
                  {detail.status}
                </Badge>
                <p>
                  {translateNode("Amount")}: {money(detail.amount)}
                </p>
                <p className="text-sm text-muted">
                  {translateNode(detail.time)}
                </p>
                <Button variant="outline" onClick={() => window.print()}>
                  {translateNode("Print")}
                </Button>
              </div>
            ) : notice ? (
              <div>
                <p>{translateNode(notice.text)}</p>
                <p className="mt-2 text-sm text-muted">
                  {translateNode(notice.time)}
                </p>
                <Button asChild className="mt-5">
                  <Link to="/notifications">
                    {translateNode("View All Notifications")}
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <Input
                  aria-label={translateString("Search invoices")}
                  placeholder={translateString("Search invoices")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <div className="mt-4 overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {["Invoice", "Customer", "Status", "Amount"].map(
                          (label) => (
                            <th key={label}>{translateNode(label)}</th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>
                            <button
                              className="text-primary hover:underline"
                              onClick={() => setDetail(invoice)}
                            >
                              #{invoice.id}
                            </button>
                          </td>
                          <td>{invoice.name}</td>
                          <td>{translateNode(invoice.status)}</td>
                          <td>{money(invoice.amount)}</td>
                        </tr>
                      ))}
                      {!visible.length && (
                        <tr>
                          <td colSpan={4}>
                            {translateNode("No invoices found")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
