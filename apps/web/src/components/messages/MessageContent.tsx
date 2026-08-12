import { Download, FileText, Maximize2, Pause, Play, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { formatFileSize, formatTime } from '../../lib/utils';
import type { Message } from '../../types';
import { Button } from '../ui/button';

export function MessageContent({ message }: { message: Message }) {
  if (message.messageType === 'image') return <div className="media-message"><div className="media-image"><img src={message.media?.url} alt={message.media?.fileName ?? 'Imagem recebida'} /><button aria-label="Ampliar imagem"><Maximize2 size={16} /></button></div><p>{message.textContent}</p></div>;
  if (message.messageType === 'document') return <div className="document-message"><div className="document-icon"><FileText size={20} /></div><div><strong>{message.media?.fileName}</strong><span>{(message.media?.mimeType.split('/')[1] ?? 'arquivo').toUpperCase()} · {formatFileSize(message.media?.fileSize ?? 0)}</span></div><Button variant="ghost" size="sm" aria-label="Baixar documento"><Download size={17} /></Button></div>;
  if (message.messageType === 'audio') return <AudioPlaceholder />;
  if (message.messageType === 'video') return <div className="video-placeholder"><Play size={28} /><span>Vídeo recebido</span></div>;
  return <p className="text-message">{message.textContent}</p>;
}
function AudioPlaceholder() { const [playing, setPlaying] = useState(false); return <div className="audio-message"><button className="audio-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}>{playing ? <Pause size={16} /> : <Play size={16} />}</button><div className="audio-wave">{Array.from({ length: 28 }).map((_, index) => <i style={{ height: `${8 + ((index * 17) % 15)}px` }} key={index} />)}</div><span>0:32</span><Volume2 size={15} /></div>; }
export function MessageBubble({ message }: { message: Message }) { return <div className={`message-line ${message.direction === 'outbound' ? 'message-outbound' : ''}`}><div className="message-bubble"><div className="message-meta"><strong>{message.direction === 'outbound' ? 'Você · ' : ''}{message.senderName}</strong><time>{formatTime(message.sentAt)}</time></div><MessageContent message={message} /></div></div>; }
