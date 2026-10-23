import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Card, CardContent, CardHeader } from './primitives';

const meta = {
  title: 'Mantis/Primitives',
  component: Button,
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => <div className="flex gap-3"><Button>Primary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button></div>,
};

export const CardExample: Story = {
  render: () => <Card className="w-80"><CardHeader title="Account overview"/><CardContent><p className="text-sm text-muted">A reusable surface for dashboard content.</p></CardContent></Card>,
};
