import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700',
        brand: 'bg-brand-100 text-brand-700',
        success: 'bg-success-500/10 text-success-600',
        warning: 'bg-cta-50 text-cta-900',
        error: 'bg-error-500/10 text-error-600',
        verified: 'bg-signal-verified/10 text-signal-verified',
        outline: 'border border-slate-300 text-slate-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
