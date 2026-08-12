import { Download, ExternalLink, FileText } from 'lucide-react';
import { formatFileSize, formatTime } from '../../lib/utils';
import { logAuditEvent } from '../../lib/audit';
import type { Message } from '../../types';

function unavailable() { return <span className="field-error">Mídia indisponível ou expirada.</span>; }

export function MessageContent({ message }: { message: Message }) {
  const media = message.media;
  if (message.messageType === 'image') return <div className="media-message">{media?.url ? <div className="media-image"><img src={media.url} alt={media.fileName || 'Imagem recebida'} /><a href={media.url} target="_blank" rel="noreferrer" aria-label="Abrir imagem" onClick={() => void logAuditEvent('VIEW_IMAGE', 'message', message.id, message.whatsappAccountId)}><ExternalLink size={16} /></a></div> : unavailable()}<p>{message.textContent}</p></div>;
  if (message.messageType === 'document') return <div className="document-message"><div className="document-icon"><FileText size={20} /></div><div><strong>{media?.fileName || 'Documento'}</strong><span>{(media?.mimeType.split('/')[1] ?? 'arquivo').toUpperCase()} · {formatFileSize(media?.fileSize ?? 0)}</span></div>{media?.url ? <a href={media.url} target="_blank" rel="noreferrer" aria-label="Baixar documento" onClick={() => void logAuditEvent('DOWNLOAD_DOCUMENT', 'message', message.id, message.whatsappAccountId)}><Download size={17} /></a> : unavailable()}</div>;
  if (message.messageType === 'audio') return media?.url ? <audio controls preload="metadata" src={media.url} onPlay={() => void logAuditEvent('PLAY_AUDIO', 'message', message.id, message.whatsappAccountId)} style={{ width: 270, maxWidth: '100%' }} /> : unavailable();
  if (message.messageType === 'video') return media?.url ? <video controls preload="metadata" src={media.url} style={{ width: 320, maxWidth: '100%', borderRadius: 10 }} onPlay={() => void logAuditEvent('VIEW_VIDEO', 'message', message.id, message.whatsappAccountId)} /> : unavailable();
  return <p className="text-message">{message.textContent}</p>;
}

export function MessageBubble({ message }: { message: Message }) {
  return <div className={`message-line ${message.direction === 'outbound' ? 'message-outbound' : ''}`}><div className="message-bubble"><div className="message-meta"><strong>{message.direction === 'outbound' ? 'Corporativo · ' : ''}{message.senderName}</strong><time>{formatTime(message.sentAt)}</time></div><MessageContent message={message} /></div></div>;
}
