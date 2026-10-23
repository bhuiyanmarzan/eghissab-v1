export const monthVisitors = [76, 85, 101, 98, 87, 105, 91, 114, 94, 89, 105, 42].map(
  (pageViews, i) => ({
    period: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    pageViews,
    sessions: [110, 60, 150, 35, 60, 30, 28, 51, 65, 53, 53, 35][i],
  }),
);
export const weekVisitors = [31, 40, 28, 51, 42, 109, 100].map((pageViews, i) => ({
  period: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  pageViews,
  sessions: [11, 32, 45, 32, 34, 52, 41][i],
}));
export const weeklyIncome = [80, 95, 70, 40, 65, 55, 78].map((income, i) => ({
  period: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][i],
  income,
}));
export const salesPeriods = ['Today', 'This Month', 'This Year'] as const;
export type SalesPeriod = (typeof salesPeriods)[number];
export const salesData: Record<SalesPeriod, { period: string; income: number; cost: number }[]> = {
  Today: [
    { period: '07.06', income: 180, cost: 120 },
    { period: '08.06', income: 90, cost: 45 },
    { period: '09.06', income: 135, cost: 78 },
    { period: '10.06', income: 114, cost: 150 },
    { period: '11.06', income: 120, cost: 168 },
    { period: '12.06', income: 200, cost: 145 },
    { period: '13.06', income: 145, cost: 99 },
  ],
  'This Month': [4200, 3800, 5100, 4700, 6000, 5400].map((income, i) => ({
    period: `Week ${i + 1}`,
    income,
    cost: [2900, 3100, 3700, 3200, 4400, 3800][i],
  })),
  'This Year': [
    18000, 21000, 19500, 24000, 22000, 27000, 25000, 28000, 31000, 29000, 32000, 35000,
  ].map((income, i) => ({
    period: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    income,
    cost: [12000, 14000, 13000, 17000, 16000, 18000, 17500, 19000, 20000, 20500, 22000, 24000][i],
  })),
};
export const salesProfit: Record<SalesPeriod, number> = {
  Today: 1560,
  'This Month': 8100,
  'This Year': 104000,
};
export const analyticsPeriods = ['Weekly', 'Monthly', 'Yearly'] as const;
export type AnalyticsPeriod = (typeof analyticsPeriods)[number];
export const analyticsValues: Record<AnalyticsPeriod, string[]> = {
  Weekly: ['+45.14%', '0.58%', 'Low'],
  Monthly: ['+38.72%', '0.62%', 'Low'],
  Yearly: ['+52.36%', '0.71%', 'Moderate'],
};
export const analyticsData: Record<AnalyticsPeriod, number[]> = {
  Weekly: [21, 45, 32, 63, 35, 70, 42, 62, 33, 52, 29, 40],
  Monthly: [35, 48, 41, 55, 42, 62, 49, 68, 57, 71, 61, 80],
  Yearly: [22, 30, 28, 45, 38, 54, 50, 64, 59, 78, 69, 88],
};
export const transactions = [
  {
    id: '002434',
    time: 'Today, 2:00 AM',
    amount: 1430,
    percentage: 78,
    tone: 'green',
    icon: 'gift',
  },
  {
    id: '984947',
    time: '5 August, 1:45 PM',
    amount: 302,
    percentage: 8,
    tone: 'blue',
    icon: 'message',
  },
  { id: '988784', time: '7 hours ago', amount: 682, percentage: 16, tone: 'red', icon: 'settings' },
] as const;
