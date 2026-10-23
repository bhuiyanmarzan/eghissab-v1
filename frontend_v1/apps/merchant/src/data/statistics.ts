export const statisticsSummary = [
  { label: 'All Earnings', value: '$30200', icon: 'earnings', color: 'gray' },
  { label: 'Task', value: '145', icon: 'task', color: 'red' },
  { label: 'Page Views', value: '290+', icon: 'views', color: 'green' },
  { label: 'Downloads', value: '500', icon: 'downloads', color: 'blue' },
] as const;
export const revenueWidgets = [
  {
    label: 'Revenue',
    value: '$4,500',
    caption: '$50,032 Last Month',
    color: 'blue',
    icon: 'revenue',
  },
  {
    label: 'Orders Received',
    value: '486',
    caption: '20% Increase',
    color: 'amber',
    icon: 'orders',
  },
  {
    label: 'Total Sales',
    value: '1641',
    caption: '$1,055 Revenue Generated',
    color: 'green',
    icon: 'sales',
  },
] as const;
export const socialWidgets = [
  { label: 'Facebook Users', value: '1165 +', color: '#3b76ff', icon: 'facebook' },
  { label: 'Twitter Users', value: '780 +', color: '#26bfc3', icon: 'twitter' },
  { label: 'Linked In Users', value: '998 +', color: '#202020', icon: 'linkedin' },
  { label: 'Youtube Videos', value: '650 +', color: '#ff4657', icon: 'youtube' },
] as const;
export const audienceWidgets = [
  {
    label: 'Impressions',
    value: '1,563',
    date: 'May 23 - June 01 (2018)',
    color: 'blue',
    icon: 'eye',
  },
  { label: 'Goal', value: '30,564', date: 'May 28 - June 01 (2018)', color: 'green', icon: 'goal' },
  {
    label: 'Impact',
    value: '42.6%',
    date: 'May 30 - June 01 (2018)',
    color: 'amber',
    icon: 'impact',
  },
] as const;
export const dailyWidgets = [
  { label: 'Daily user', value: '1,658', color: 'green', icon: 'user' },
  { label: 'Daily page view', value: '1K', color: 'blue', icon: 'page' },
  { label: 'Last month visitor', value: '5,678', color: 'amber', icon: 'visitor' },
] as const;
export const projectProgress = [
  { label: 'Published Project', value: 30, tone: 'blue' },
  { label: 'Completed Task', value: 90, tone: 'green' },
  { label: 'Pending Task', value: 50, tone: 'red' },
  { label: 'Issues', value: 55, tone: 'amber' },
] as const;
export const learningMembers = [
  { id: 'cindy', name: 'Cindy Baker', avatar: '/notification-avatars/aida.png' },
  { id: 'travis', name: 'Travis Howard', avatar: '/statistics/avatar-travis.png' },
  { id: 'remy', name: 'Remy Sharp', avatar: '/statistics/avatar-remy.png' },
  { id: 'agnes', name: 'Agnes Walker', avatar: '/notification-avatars/cristina.png' },
  { id: 'ian', name: 'Ian Dawson', avatar: '/notification-avatars/ian.png' },
  { id: 'emily', name: 'Emily Taylor', avatar: '/notification-avatars/emily.png' },
] as const;
export const initialLearningMembers = ['cindy', 'travis', 'remy', 'agnes', 'ian'];
