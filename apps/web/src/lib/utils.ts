import { clsx, type ClassValue } from 'clsx';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) { return clsx(inputs); }

export function formatTime(value: string) { return format(new Date(value), 'HH:mm'); }
export function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (isToday(date)) return `Hoje, ${formatTime(value)}`;
  if (isYesterday(date)) return `Ontem, ${formatTime(value)}`;
  return format(date, "dd 'de' MMM, HH:mm", { locale: ptBR });
}
export function formatFileSize(bytes: number) { return `${(bytes / 1000).toFixed(0)} KB`; }
export function titleFromAction(action: string) {
  return action.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
