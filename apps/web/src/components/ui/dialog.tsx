import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export function Dialog({ open, onClose, title, description, children, width = '420px' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; width?: string }) {
  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="dialog" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog-head"><div><h2 id="dialog-title">{title}</h2>{description && <p>{description}</p>}</div><Button variant="ghost" size="sm" aria-label="Fechar" onClick={onClose}><X size={18} /></Button></div>
      {children}
    </section>
  </div>;
}
