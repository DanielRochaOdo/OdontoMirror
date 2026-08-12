import { useQuery } from '@tanstack/react-query';
import { accounts, auditLogs, conversations, messages } from '../data/demo';

const wait = <T,>(value: T, ms = 180) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export function useWhatsAppAccounts() { return useQuery({ queryKey: ['whatsapp-accounts'], queryFn: () => wait(accounts) }); }
export function useWhatsAppAccount(accountId?: string) { return useQuery({ queryKey: ['whatsapp-account', accountId], queryFn: () => wait(accounts.find((account) => account.id === accountId)), enabled: Boolean(accountId) }); }
export function useConversations(accountId?: string, search = '') {
  return useQuery({ queryKey: ['conversations', accountId, search], queryFn: () => wait(conversations.filter((item) => item.whatsappAccountId === accountId && (item.contact.name.toLowerCase().includes(search.toLowerCase()) || item.contact.phone.includes(search)))) , enabled: Boolean(accountId) });
}
export function useConversation(conversationId?: string) { return useQuery({ queryKey: ['conversation', conversationId], queryFn: () => wait(conversations.find((item) => item.id === conversationId)), enabled: Boolean(conversationId) }); }
export function useMessages(accountId?: string, conversationId?: string) { return useQuery({ queryKey: ['messages', accountId, conversationId], queryFn: () => wait(messages.filter((item) => item.whatsappAccountId === accountId && item.conversationId === conversationId)), enabled: Boolean(accountId && conversationId) }); }
export function useAuditLogs() { return useQuery({ queryKey: ['audit-logs'], queryFn: () => wait(auditLogs) }); }
