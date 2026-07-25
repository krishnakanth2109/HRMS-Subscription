import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaTimes, FaCheck, FaSearchPlus, FaSearchMinus, FaRedo, FaUndo, FaCompress } from "react-icons/fa";

const ImageCropModal = ({ imageSrc, onCropComplete, onCancel, isUploading }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // State for drag interaction
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const previewRef = useRef(null);
  const modalRef = useRef(null);

  // Initialize image dimensions when loaded
  useEffect(() => {
    if (imageSrc) {
      setImageLoaded(false);
      const img = new Image();
      img.onload = () => {
        setImageDimensions({
          width: img.width,
          height: img.height
        });
        setImageLoaded(true);
      };
      img.src = imageSrc;
    }
  }, [imageSrc]);

  // --- DRAG EVENT HANDLERS (mouse) ---
  const onMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragStartPosition({ ...position });
  };

  const onMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setPosition({
      x: dragStartPosition.x + deltaX,
      y: dragStartPosition.y + deltaY,
    });
  }, [isDragging, dragStart, dragStartPosition]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      return () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
    }
  }, [isDragging, onMouseMove, onMouseUp]);

  // --- DRAG EVENT HANDLERS (touch, single finger pan) ---
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setDragStartPosition({ ...position });
  };

  const onTouchMove = useCallback((e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    setPosition({
      x: dragStartPosition.x + deltaX,
      y: dragStartPosition.y + deltaY,
    });
  }, [isDragging, dragStart, dragStartPosition]);

  const onTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
      return () => {
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onTouchEnd);
      };
    }
  }, [isDragging, onTouchMove, onTouchEnd]);

  // --- SCROLL TO ZOOM ---
  const onWheel = useCallback((e) => {
    if (isUploading) return;
    e.preventDefault();
    setScale((prev) => {
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      return Math.min(3, Math.max(0.5, parseFloat((prev + delta).toFixed(2))));
    });
  }, [isUploading]);

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isUploading) return;
      switch (e.key) {
        case "Escape":
          onCancel();
          break;
        case "+":
        case "=":
          setScale((s) => Math.min(3, parseFloat((s + 0.1).toFixed(2))));
          break;
        case "-":
        case "_":
          setScale((s) => Math.max(0.5, parseFloat((s - 0.1).toFixed(2))));
          break;
        case "ArrowLeft":
          setRotation((r) => (r - 90 + 360) % 360);
          break;
        case "ArrowRight":
          setRotation((r) => (r + 90) % 360);
          break;
        case "0":
          handleReset();
          break;
        case "Enter":
          if (!isUploading) handleCrop();
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploading, onCancel]);

  // Calculate image display dimensions and position
  const getImageTransform = () => {
    const container = previewRef.current;
    if (!container || !imageDimensions.width) return { width: 0, height: 0, x: 0, y: 0 };

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    const imgAspect = imageDimensions.width / imageDimensions.height;
    const containerAspect = containerWidth / containerHeight;

    let renderWidth, renderHeight;

    if (imgAspect > containerAspect) {
      // Image is wider than container
      renderWidth = containerWidth;
      renderHeight = containerWidth / imgAspect;
    } else {
      // Image is taller than container
      renderHeight = containerHeight;
      renderWidth = containerHeight * imgAspect;
    }

    return {
      width: renderWidth * scale,
      height: renderHeight * scale,
      x: (containerWidth - renderWidth) / 2 + position.x,
      y: (containerHeight - renderHeight) / 2 + position.y
    };
  };

  // --- CROP HANDLER ---
  const handleCrop = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const container = previewRef.current;

    if (!canvas || !image || !container) return;

    const ctx = canvas.getContext("2d");

    // Output size 500x500
    const outputSize = 500;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Get container and image dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    const imgWidth = imageDimensions.width;
    const imgHeight = imageDimensions.height;
    const imgAspect = imgWidth / imgHeight;
    const containerAspect = containerWidth / containerHeight;

    // Calculate displayed image dimensions
    let displayWidth, displayHeight;
    if (imgAspect > containerAspect) {
      displayWidth = containerWidth;
      displayHeight = containerWidth / imgAspect;
    } else {
      displayHeight = containerHeight;
      displayWidth = containerHeight * imgAspect;
    }

    // Apply scale
    displayWidth *= scale;
    displayHeight *= scale;

    // Calculate crop area (circle in center)
    const cropDiameter = Math.min(containerWidth, containerHeight) * 0.8;
    const cropX = (containerWidth - cropDiameter) / 2;
    const cropY = (containerHeight - cropDiameter) / 2;

    // Calculate source coordinates in original image
    const scaleX = imgWidth / displayWidth;
    const scaleY = imgHeight / displayHeight;

    const sourceX = (cropX - position.x - (containerWidth - displayWidth) / 2) * scaleX;
    const sourceY = (cropY - position.y - (containerHeight - displayHeight) / 2) * scaleY;
    const sourceDiameter = cropDiameter * scaleX;

    // Clear canvas and setup
    ctx.clearRect(0, 0, outputSize, outputSize);
    ctx.save();

    // Create circular clipping path
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI);
    ctx.clip();

    // Apply rotation
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-outputSize / 2, -outputSize / 2);

    // Draw the cropped image
    ctx.drawImage(
      image,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      Math.min(sourceDiameter, imgWidth - sourceX),
      Math.min(sourceDiameter, imgHeight - sourceY),
      0,
      0,
      outputSize,
      outputSize
    );

    ctx.restore();

    // Convert to blob and return
    canvas.toBlob((blob) => {
      if (blob) onCropComplete(blob);
    }, "image/jpeg", 0.95);
  };

  // Reset all transformations
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Quick zoom presets
  const handleZoomIn = () => setScale((s) => Math.min(3, parseFloat((s + 0.2).toFixed(2))));
  const handleZoomOut = () => setScale((s) => Math.max(0.5, parseFloat((s - 0.2).toFixed(2))));
  const handleZoomFit = () => setScale(1);

  const imageTransform = getImageTransform();

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 flex items-center justify-center z-50 p-3 sm:p-6 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
    >
      <div
        ref={modalRef}
        className="relative bg-white dark:bg-[#141416] rounded-[28px] w-full max-w-lg lg:max-w-3xl max-h-[94vh] flex flex-col lg:flex-row shadow-2xl dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)] border border-slate-200/90 dark:border-white/[0.08] animate-[scaleIn_0.25s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
      >
        {/* Left / top column: header + viewfinder */}
        <div className="flex flex-col lg:w-[55%] lg:flex-shrink-0 min-h-0">
          {/* Header */}
          <div className="flex justify-between items-start px-5 pt-5 pb-3 flex-shrink-0">
            <div>
              <h3
                id="crop-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight"
              >
                Adjust photo
              </h3>
              <p className="text-slate-500 dark:text-zinc-400 text-xs mt-0.5">
                Drag to reposition · scroll or pinch to zoom
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={isUploading}
              aria-label="Close crop dialog"
              className="text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
            >
              <FaTimes size={16} />
            </button>
          </div>

          {/* Viewfinder — camera viewfinder */}
          <div className="px-5 pb-5 lg:pb-5 flex-1 min-h-0">
            <div
              ref={previewRef}
              className="relative bg-black rounded-2xl overflow-hidden aspect-square w-full max-h-[52vh] lg:max-h-[60vh] mx-auto border border-slate-200 dark:border-white/10 select-none shadow-inner"
            >
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 border-2 border-white/20 border-t-teal-300 rounded-full animate-spin" />
                </div>
              )}

              {/* Image Container */}
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onDoubleClick={handleReset}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: "center",
                  transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="To crop"
                  className="max-w-none select-none pointer-events-none"
                  style={{
                    width: imageTransform.width,
                    height: imageTransform.height
                  }}
                  draggable={false}
                />
              </div>

              {/* Crop overlay: dark mask + focus ring + viewfinder brackets */}
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full">
                  <defs>
                    <mask id="cropMask">
                      <rect width="100%" height="100%" fill="white" />
                      <circle cx="50%" cy="50%" r="40%" fill="black" />
                    </mask>
                  </defs>

                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#cropMask)" />

                  {/* Solid focus ring */}
                  <circle cx="50%" cy="50%" r="40%" fill="none" stroke="rgba(94,234,212,0.9)" strokeWidth="1.5" />

                  {/* Rotating dashed ring — subtle "live" signature */}
                  <circle
                    cx="50%" cy="50%" r="43%"
                    fill="none"
                    stroke="rgba(94,234,212,0.35)"
                    strokeWidth="1"
                    strokeDasharray="2,8"
                    className="origin-center animate-[spin_18s_linear_infinite]"
                    style={{ transformBox: "fill-box" }}
                  />
                </svg>

                {/* Camera-style corner brackets */}
                {[
                  "top-3 left-3 border-t-2 border-l-2 rounded-tl-lg",
                  "top-3 right-3 border-t-2 border-r-2 rounded-tr-lg",
                  "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg",
                  "bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg"
                ].map((pos, i) => (
                  <div key={i} className={`absolute ${pos} w-5 h-5 border-teal-300/70`} />
                ))}

                {rotation !== 0 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-teal-300 text-xs font-mono px-2.5 py-1 rounded-full border border-white/10">
                    {rotation}°
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right / bottom column: full control set */}
        <div className="flex flex-col lg:w-[45%] lg:border-l border-t lg:border-t-0 border-slate-200/80 dark:border-white/[0.08] px-5 py-4 lg:py-5 gap-4 overflow-y-auto bg-slate-50/50 dark:bg-[#141416]">
          {/* Zoom */}
          <div className="bg-white dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/[0.08] rounded-2xl p-3.5 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">Zoom</span>
              <span className="text-xs font-mono text-teal-600 dark:text-teal-400 font-bold tabular-nums">{Math.round(scale * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleZoomOut}
                disabled={isUploading || scale <= 0.5}
                aria-label="Zoom out"
                className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                <FaSearchMinus size={12} />
              </button>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                aria-label="Zoom level"
                className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb"
                disabled={isUploading}
              />
              <button
                onClick={handleZoomIn}
                disabled={isUploading || scale >= 3}
                aria-label="Zoom in"
                className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                <FaSearchPlus size={12} />
              </button>
            </div>
          </div>

          {/* Rotation */}
          <div className="bg-white dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/[0.08] rounded-2xl p-3.5 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">Rotation</span>
              <span className="text-xs font-mono text-teal-600 dark:text-teal-400 font-bold tabular-nums">{rotation}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value, 10))}
              aria-label="Rotation angle"
              className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb mb-3"
              disabled={isUploading}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                disabled={isUploading}
                aria-label="Rotate left 90 degrees"
                className="flex-1 flex items-center justify-center gap-1.5 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                <FaUndo size={11} /> 90°
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                disabled={isUploading}
                aria-label="Rotate right 90 degrees"
                className="flex-1 flex items-center justify-center gap-1.5 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                <FaRedo size={11} /> 90°
              </button>
            </div>
          </div>

          {/* Position + reset */}
          <div className="bg-white dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/[0.08] rounded-2xl p-3.5 shadow-sm dark:shadow-none">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-center">
                <div className="text-slate-400 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wide">X position</div>
                <div className="font-mono text-sm text-slate-900 dark:text-zinc-100 font-semibold">{Math.round(position.x)}px</div>
              </div>
              <div className="text-center">
                <div className="text-slate-400 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wide">Y position</div>
                <div className="font-mono text-sm text-slate-900 dark:text-zinc-100 font-semibold">{Math.round(position.y)}px</div>
              </div>
            </div>
            <button
              onClick={handleReset}
              disabled={isUploading}
              aria-label="Reset all adjustments"
              className="w-full flex items-center justify-center gap-1.5 text-slate-700 dark:text-zinc-300 hover:text-teal-600 dark:hover:text-teal-400 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
            >
              <FaCompress size={11} /> Reset all
            </button>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-zinc-400 text-center leading-relaxed mt-auto pt-1 hidden sm:block">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 font-mono text-slate-600 dark:text-zinc-300">+</kbd>/<kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 font-mono text-slate-600 dark:text-zinc-300">−</kbd> zoom ·{" "}
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 font-mono text-slate-600 dark:text-zinc-300">←</kbd>/<kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 font-mono text-slate-600 dark:text-zinc-300">→</kbd> rotate ·{" "}
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 font-mono text-slate-600 dark:text-zinc-300">0</kbd> reset ·{" "}
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 font-mono text-slate-600 dark:text-zinc-300">esc</kbd> cancel
          </div>

          {/* Hidden Canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Footer Actions */}
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={onCancel}
              disabled={isUploading}
              className="px-5 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40"
            >
              Cancel
            </button>
            <button
              onClick={handleCrop}
              disabled={isUploading || !imageLoaded}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-teal-500 hover:bg-teal-400 dark:bg-teal-400 dark:hover:bg-teal-300 text-slate-950 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_8px_24px_-8px_rgba(45,212,191,0.5)] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full" />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <FaCheck size={13} />
                  <span>Save photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: #0d9488;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.3);
          transition: transform 0.15s ease;
        }
        .dark .slider-thumb::-webkit-slider-thumb {
          background: #2dd4bf;
          border: 2px solid #141416;
          box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.6);
        }
        .slider-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .slider-thumb::-moz-range-thumb {
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: #0d9488;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.3);
          transition: transform 0.15s ease;
        }
        .dark .slider-thumb::-moz-range-thumb {
          background: #2dd4bf;
          border: 2px solid #141416;
          box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.6);
        }
        .slider-thumb::-moz-range-thumb:hover {
          transform: scale(1.2);
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ImageCropModal;