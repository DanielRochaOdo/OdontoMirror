import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'sm' | 'md' | 'lg'; }

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return <button className={cn('button', `button-${variant}`, `button-${size}`, className)} {...props} />;
}
