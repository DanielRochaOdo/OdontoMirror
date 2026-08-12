import { clsx, type ClassValue } from 'clsx';
import { format, isToday, isYesterday, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) { return clsx(inputs); }
export function formatTime(value?: string) { if (!value) return '—'; const date = new Date(value); return isValid(date) ? format(date, 'HH:mm') : '—'; }
export function formatRelativeDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (!isValid(date)) return '—';
  if (isToday(date)) return `Hoje, ${formatTime(value)}`;
  if (isYesterday(date)) return `Ontem, ${formatTime(value)}`;
  return format(date, "dd 'de' MMM, HH:mm", { locale: ptBR });
}
export function formatFileSize(bytes: number) { if (!bytes) return '0 KB'; if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`; return `${Math.max(1, Math.round(bytes / 1000))} KB`; }
export function titleFromAction(action: string) { return action.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
