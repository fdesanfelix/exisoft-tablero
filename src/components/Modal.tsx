import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  // Cerrar con tecla Esc (gesto estándar para cerrar). NO se cierra al click afuera —
  // molesta cuando estás editando y por error tocás al lado del modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>
          <span>{title}</span>
          <button className="close" onClick={onClose} aria-label="Cerrar">×</button>
        </h3>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
