import { useTranslation } from 'react-i18next';
import { translateNode } from '../../lib/localization';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary-strong',
        outline: 'border border-border bg-surface hover:bg-subtle',
        ghost: 'hover:bg-subtle',
        danger: 'bg-danger text-white hover:bg-red-600',
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3 text-xs', icon: 'size-9 p-0' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('rounded-lg border border-border bg-surface shadow-card', className)} {...props} />;
}

export function CardHeader({ title, action, className }: { title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  useTranslation();
  return (
    <div className={cn('flex min-h-12 items-center justify-between border-b border-border px-5 py-3', className)}>
      <h3 className="text-sm font-semibold text-ink">{translateNode(title)}</h3>{action}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/10', className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  useTranslation();
  return <select className={cn('h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary', className)} {...props}>{translateNode(children)}</select>;
}

export function Badge({ children, tone = 'blue', className }: { children: React.ReactNode; tone?: 'blue' | 'green' | 'red' | 'amber' | 'cyan' | 'gray'; className?: string }) {
  useTranslation();
  const tones = { blue: 'bg-primary-soft text-primary', green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-700', cyan: 'bg-cyan-50 text-cyan-600', gray: 'bg-slate-100 text-slate-600' };
  return <span className={cn('inline-flex rounded px-2 py-1 text-xs font-medium', tones[tone], className)}>{translateNode(children)}</span>;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2);
  const palette = ['bg-primary-soft text-primary', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700'];
  const dimension = size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-16 text-lg' : 'size-10 text-sm';
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', palette[name.length % palette.length], dimension)}>{initials}</span>;
}

export function Progress({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const colors = { blue: 'bg-primary', green: 'bg-success', amber: 'bg-warning', red: 'bg-danger' };
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-soft"><div className={cn('h-full rounded-full', colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-100', className)} />;
}
