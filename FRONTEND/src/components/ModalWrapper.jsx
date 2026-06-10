import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A centralized, reusable Modal wrapper component.
 * Features:
 * - Closes automatically when pressing the 'Escape' key.
 * - Closes automatically when clicking the background overlay.
 * - Disables background page scrolling when the modal is active.
 * - Uses React Portals to render at the top level of the DOM.
 * 
 * Props:
 * - isOpen (boolean): Controls whether the modal is visible.
 * - onClose (function): Handler called to close the modal.
 * - children (React.ReactNode): The content inside the modal.
 * - backdropClass (string): Optional custom classes for the backdrop overlay.
 * - containerClass (string): Optional custom classes for the modal card container.
 */
const ModalWrapper = ({
  isOpen,
  onClose,
  children,
  backdropClass = "fixed inset-0 bg-slate-900/10 flex items-center justify-center z-[9999] p-4 backdrop-blur-md animate-fadeIn",
  containerClass = "bg-white/90 border border-white/50 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg w-full p-6 relative flex flex-col max-h-[85vh] outline-none animate-scaleIn"
}) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" || event.keyCode === 27) {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    
    // Prevent background scrolling
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className={backdropClass} 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={containerClass}>
        {children}
      </div>
    </div>,
    document.body
  );
};

export default ModalWrapper;
