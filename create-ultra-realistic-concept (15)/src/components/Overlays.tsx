import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  wide?: boolean;
  drawer?: boolean;
}

export function Modal({ open, onClose, title, eyebrow, children, wide = false, drawer = false }: ModalProps) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 80);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter((element) => element.offsetParent !== null);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`modal-backdrop ${drawer ? "modal-backdrop--drawer" : ""}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`modal-card ${wide ? "modal-card--wide" : ""} ${drawer ? "modal-card--drawer" : ""}`}
            initial={reduceMotion ? { opacity: 0 } : drawer ? { x: "100%" } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={reduceMotion ? { opacity: 1 } : drawer ? { x: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : drawer ? { x: "100%" } : { opacity: 0, y: 12, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
          >
            <header className="modal-header">
              <div>
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                <h2>{title}</h2>
              </div>
              <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19} /></button>
            </header>
            <div className="modal-content">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface ToastMessage {
  id: number;
  title: string;
  detail?: string;
}

export function ToastStack({ messages }: { messages: ToastMessage[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            className="toast"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
            transition={{ duration: 0.22 }}
          >
            <span className="toast-check"><Check size={13} strokeWidth={2.5} /></span>
            <div><strong>{message.title}</strong>{message.detail && <p>{message.detail}</p>}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
