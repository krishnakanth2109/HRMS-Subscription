import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaTimes, FaCheck, FaSearchPlus, FaSearchMinus, FaRedo, FaUndo, FaExpand, FaCompress } from "react-icons/fa";

const ImageCropModal = ({ imageSrc, onCropComplete, onCancel, isUploading }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  // State for drag interaction
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const previewRef = useRef(null);

  // Initialize image dimensions when loaded
  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({
          width: img.width,
          height: img.height
        });
      };
      img.src = imageSrc;
    }
  }, [imageSrc]);

  // --- DRAG EVENT HANDLERS ---
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
  const handleZoomIn = () => setScale(Math.min(3, scale + 0.2));
  const handleZoomOut = () => setScale(Math.max(0.5, scale - 0.2));
  const handleZoomFit = () => setScale(1);

  const imageTransform = getImageTransform();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 max-w-6xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <div>
            <h3 className="text-3xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Crop Your Profile Picture
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Adjust the image to fit within the circle
            </p>
          </div>
          <button 
            onClick={onCancel} 
            disabled={isUploading} 
            className="text-gray-400 hover:text-gray-600 p-3 rounded-xl hover:bg-gray-100 transition-all duration-300 disabled:opacity-50 transform hover:scale-110"
          >
            <FaTimes size={24} />
          </button>
        </div>
        
        {/* Main Content */}
        <div className="flex-grow overflow-hidden flex flex-col lg:flex-row gap-6">
          {/* Preview Section */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-700">Preview</h4>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FaExpand className="text-blue-500" />
                <span>Drag to move • Scroll to zoom</span>
              </div>
            </div>
            
            <div 
              ref={previewRef}
              className="relative bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl overflow-hidden flex-1 min-h-[400px] border-2 border-gray-300 shadow-inner"
            >
              {/* Image Container */}
              <div
                className={`absolute inset-0 flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={onMouseDown}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: 'center',
                  transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <img 
                  ref={imageRef} 
                  src={imageSrc} 
                  alt="To crop" 
                  className="max-w-none select-none pointer-events-none shadow-2xl"
                  style={{
                    width: imageTransform.width,
                    height: imageTransform.height
                  }}
                  draggable={false}
                />
              </div>
              
              {/* Enhanced Crop Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full">
                  <defs>
                    <mask id="cropMask">
                      <rect width="100%" height="100%" fill="white" />
                      <circle cx="50%" cy="50%" r="40%" fill="black" />
                    </mask>
                    <radialGradient id="borderGradient">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
                    </radialGradient>
                  </defs>
                  
                  {/* Dark overlay outside crop area */}
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#cropMask)" />
                  
                  {/* Border with gradient */}
                  <circle 
                    cx="50%" 
                    cy="50%" 
                    r="40%" 
                    fill="none" 
                    stroke="url(#borderGradient)" 
                    strokeWidth="3"
                  />
                  
                  {/* Inner subtle border */}
                  <circle 
                    cx="50%" 
                    cy="50%" 
                    r="39.5%" 
                    fill="none" 
                    stroke="rgba(255,255,255,0.3)" 
                    strokeWidth="1"
                  />
                  
                  {/* Guide lines */}
                  <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />
                  <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />
                </svg>
                
                {/* Instructions */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
                  🎯 Center your face in the circle
                </div>
              </div>
            </div>
          </div>

          {/* Controls Section */}
          <div className="lg:w-80 flex flex-col gap-6">
            {/* Zoom Controls */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <label className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FaSearchPlus className="text-blue-500" />
                  Zoom: {Math.round(scale * 100)}%
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={handleZoomOut}
                    disabled={isUploading || scale <= 0.5}
                    className="p-2 hover:bg-white rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed transform hover:scale-110 shadow-sm"
                  >
                    <FaSearchMinus className="text-gray-700" />
                  </button>
                  <button
                    onClick={handleZoomFit}
                    disabled={isUploading}
                    className="p-2 hover:bg-white rounded-xl transition-all duration-200 transform hover:scale-110 shadow-sm"
                  >
                    <FaCompress className="text-gray-700" />
                  </button>
                  <button
                    onClick={handleZoomIn}
                    disabled={isUploading || scale >= 3}
                    className="p-2 hover:bg-white rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed transform hover:scale-110 shadow-sm"
                  >
                    <FaSearchPlus className="text-gray-700" />
                  </button>
                </div>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.1" 
                value={scale} 
                onChange={(e) => setScale(parseFloat(e.target.value))} 
                className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                disabled={isUploading}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>50%</span>
                <span>100%</span>
                <span>300%</span>
              </div>
            </div>
            
            {/* Rotation Controls */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-2xl border border-purple-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <label className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FaRedo className="text-purple-500" />
                  Rotation: {rotation}°
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setRotation((rotation - 90 + 360) % 360)}
                    disabled={isUploading}
                    className="p-2 hover:bg-white rounded-xl transition-all duration-200 transform hover:scale-110 shadow-sm"
                  >
                    <FaUndo className="text-gray-700" />
                  </button>
                  <button
                    onClick={() => setRotation((rotation + 90) % 360)}
                    disabled={isUploading}
                    className="p-2 hover:bg-white rounded-xl transition-all duration-200 transform hover:scale-110 shadow-sm"
                  >
                    <FaRedo className="text-gray-700" />
                  </button>
                </div>
              </div>
              <input 
                type="range" 
                min="0" 
                max="360" 
                step="1" 
                value={rotation} 
                onChange={(e) => setRotation(parseInt(e.target.value))} 
                className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                disabled={isUploading}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>0°</span>
                <span>180°</span>
                <span>360°</span>
              </div>
            </div>

            {/* Position Info */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-gray-500">X Position</div>
                  <div className="font-mono font-bold text-gray-800">{Math.round(position.x)}px</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">Y Position</div>
                  <div className="font-mono font-bold text-gray-800">{Math.round(position.y)}px</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Footer Actions */}
        <div className="flex gap-4 pt-6 border-t border-gray-200 mt-6 flex-shrink-0">
          <button 
            onClick={handleReset}
            disabled={isUploading}
            className="px-6 py-4 rounded-xl font-semibold bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 hover:from-gray-300 hover:to-gray-400 transition-all duration-300 disabled:opacity-50 transform hover:scale-105 shadow-md flex items-center gap-2"
          >
            <FaUndo />
            Reset All
          </button>
          <button 
            onClick={onCancel} 
            disabled={isUploading} 
            className="flex-1 py-4 rounded-xl font-semibold bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 hover:from-gray-300 hover:to-gray-400 transition-all duration-300 disabled:opacity-50 transform hover:scale-105 shadow-md"
          >
            Cancel
          </button>
          <button 
            onClick={handleCrop} 
            disabled={isUploading} 
            className="flex-1 py-4 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 transform hover:scale-105 shadow-lg flex items-center justify-center gap-3"
          >
            {isUploading ? (
              <>
                <div className="animate-spin h-6 w-6 border-3 border-white border-t-transparent rounded-full" />
                <span className="animate-pulse">Uploading...</span>
              </>
            ) : (
              <>
                <FaCheck className="text-lg" />
                <span className="text-shadow">Crop & Save</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom Slider Styles */}
      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        
        .slider-thumb::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        
        .text-shadow {
          text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
};

export default ImageCropModal;