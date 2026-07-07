import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as fabric from 'fabric';

const ImageEditorModal = ({ imageSrc, fileName, onSave, onClose }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [history, setHistory] = useState([]);
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const originalFileName = useRef(fileName || 'edited_image.jpg');

  // Load Image and downscale
  useEffect(() => {
    const initCanvas = async () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Downscale to max 1600px longest side
        const MAX_DIMENSION = 1600;
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width *= ratio;
          height *= ratio;
        }

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        const ctx = offscreenCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const downscaledSrc = offscreenCanvas.toDataURL('image/jpeg');

        const canvas = new fabric.Canvas(canvasRef.current, {
          width: window.innerWidth * 0.9,
          height: window.innerHeight * 0.8,
          backgroundColor: '#333',
        });

        fabric.Image.fromURL(downscaledSrc, { crossOrigin: 'anonymous' }).then((fImg) => {
          // Fit image to canvas viewport
          const scale = Math.min(canvas.width / fImg.width, canvas.height / fImg.height) * 0.95;
          fImg.set({
            scaleX: scale,
            scaleY: scale,
            originX: 'center',
            originY: 'center',
            left: canvas.width / 2,
            top: canvas.height / 2,
            selectable: false,
            evented: false,
          });

          canvas.backgroundImage = fImg;
          canvas.renderAll();
          setFabricCanvas(canvas);
          saveHistory(canvas);
        });
      };
      img.src = imageSrc;
    };

    if (canvasRef.current && !fabricCanvas) {
      initCanvas();
    }

    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, []);

  const saveHistory = (canvas) => {
    if (!canvas) return;
    setHistory(prev => {
      const newHistory = [...prev, JSON.stringify(canvas.toJSON())];
      if (newHistory.length > 20) newHistory.shift(); // Cap at 20
      return newHistory;
    });
  };

  const handleUndo = () => {
    if (history.length <= 1 || !fabricCanvas) return;
    const previousState = history[history.length - 2];
    setHistory(prev => prev.slice(0, prev.length - 1));
    fabricCanvas.loadFromJSON(previousState, () => {
      fabricCanvas.renderAll();
    });
  };

  const handleReset = () => {
    if (history.length === 0 || !fabricCanvas) return;
    const initialState = history[0];
    setHistory([initialState]);
    fabricCanvas.loadFromJSON(initialState, () => {
      fabricCanvas.renderAll();
    });
  };

  const handleRotate = (angle) => {
    if (!fabricCanvas || !fabricCanvas.backgroundImage) return;
    const bgImage = fabricCanvas.backgroundImage;
    const currentAngle = bgImage.angle || 0;
    bgImage.rotate((currentAngle + angle) % 360);
    fabricCanvas.renderAll();
    saveHistory(fabricCanvas);
  };

  const togglePencil = () => {
    if (!fabricCanvas) return;
    fabricCanvas.isDrawingMode = !fabricCanvas.isDrawingMode;
    if (fabricCanvas.isDrawingMode) {
      fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
      fabricCanvas.freeDrawingBrush.color = '#ff0000'; // Default red
      fabricCanvas.freeDrawingBrush.width = 3;
    }
    // Record history on mouse up after drawing
    fabricCanvas.off('path:created');
    fabricCanvas.on('path:created', () => saveHistory(fabricCanvas));
  };

  const setPencilColor = (color) => {
    if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = color;
    }
  };

  const setPencilWidth = (width) => {
    if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.width = width;
    }
  };

  const addText = () => {
    if (!fabricCanvas) return;
    fabricCanvas.isDrawingMode = false;
    const text = new fabric.IText('Edit Text', {
      left: fabricCanvas.width / 2,
      top: fabricCanvas.height / 2,
      fontSize: 32,
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
      stroke: '#000000',
      strokeWidth: 1,
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    
    // Save history after modifying
    text.on('modified', () => saveHistory(fabricCanvas));
    saveHistory(fabricCanvas);
  };

  const toggleCrop = () => {
    if (!fabricCanvas) return;
    if (isCropping && cropRect) {
      fabricCanvas.remove(cropRect);
      setIsCropping(false);
      setCropRect(null);
      return;
    }

    fabricCanvas.isDrawingMode = false;
    const bgImage = fabricCanvas.backgroundImage;
    if (!bgImage) return;

    // Create a semi-transparent rect over the image bounds as starting crop area
    const rect = new fabric.Rect({
      left: bgImage.left - (bgImage.width * bgImage.scaleX) / 2,
      top: bgImage.top - (bgImage.height * bgImage.scaleY) / 2,
      width: bgImage.width * bgImage.scaleX,
      height: bgImage.height * bgImage.scaleY,
      fill: 'rgba(0,0,0,0.3)',
      borderColor: '#00bfff',
      cornerColor: '#00bfff',
      cornerSize: 12,
      transparentCorners: false,
      hasRotatingPoint: false,
      lockRotation: true,
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    setCropRect(rect);
    setIsCropping(true);
  };

  const applyCrop = () => {
    if (!fabricCanvas || !cropRect) return;
    
    // Calculate crop parameters
    const rectBounding = cropRect.getBoundingRect();
    
    // Create cropped data URL
    const croppedDataUrl = fabricCanvas.toDataURL({
      left: rectBounding.left,
      top: rectBounding.top,
      width: rectBounding.width,
      height: rectBounding.height,
      format: 'jpeg',
      quality: 1,
    });

    // Clear canvas and load new cropped image as background
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#333';
    
    fabric.Image.fromURL(croppedDataUrl, { crossOrigin: 'anonymous' }).then((fImg) => {
      // Fit new image to canvas viewport
      const scale = Math.min(fabricCanvas.width / fImg.width, fabricCanvas.height / fImg.height) * 0.95;
      fImg.set({
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        left: fabricCanvas.width / 2,
        top: fabricCanvas.height / 2,
        selectable: false,
        evented: false,
      });

      fabricCanvas.backgroundImage = fImg;
      fabricCanvas.renderAll();
      setIsCropping(false);
      setCropRect(null);
      saveHistory(fabricCanvas);
    });
  };

  const handleSave = () => {
    if (!fabricCanvas) return;
    
    // To only capture the background image area without the gray padding
    const bgImage = fabricCanvas.backgroundImage;
    let exportLeft = 0;
    let exportTop = 0;
    let exportWidth = fabricCanvas.width;
    let exportHeight = fabricCanvas.height;
    
    if (bgImage) {
        const bgBound = bgImage.getBoundingRect();
        exportLeft = bgBound.left;
        exportTop = bgBound.top;
        exportWidth = bgBound.width;
        exportHeight = bgBound.height;
    }

    const dataUrl = fabricCanvas.toDataURL({
      left: exportLeft,
      top: exportTop,
      width: exportWidth,
      height: exportHeight,
      format: 'jpeg',
      quality: 0.9,
    });

    // Convert dataURL to File
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    // Ensure filename ends with .jpg
    const safeName = originalFileName.current.replace(/\.[^/.]+$/, "") + ".jpg";
    const file = new File([u8arr], safeName, { type: mime });

    onSave(file, dataUrl);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          {isCropping ? (
            <>
              <button onClick={applyCrop} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-500">Apply Crop</button>
              <button onClick={toggleCrop} className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">Cancel Crop</button>
            </>
          ) : (
            <button onClick={toggleCrop} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600">Crop</button>
          )}

          <button onClick={() => handleRotate(-90)} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600">Rot Left</button>
          <button onClick={() => handleRotate(90)} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600">Rot Right</button>
          <button onClick={togglePencil} className={`px-3 py-1.5 text-white rounded text-sm ${fabricCanvas?.isDrawingMode ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Pencil</button>
          
          {fabricCanvas?.isDrawingMode && (
             <div className="flex items-center gap-1 ml-2">
                <button onClick={() => setPencilColor('#ff0000')} className="w-5 h-5 bg-red-500 rounded-full"></button>
                <button onClick={() => setPencilColor('#0000ff')} className="w-5 h-5 bg-blue-500 rounded-full"></button>
                <button onClick={() => setPencilColor('#000000')} className="w-5 h-5 bg-black border border-white rounded-full"></button>
                <button onClick={() => setPencilWidth(3)} className="ml-2 text-white text-xs px-2 py-1 bg-gray-600 rounded">Thin</button>
                <button onClick={() => setPencilWidth(8)} className="text-white text-xs px-2 py-1 bg-gray-600 rounded">Thick</button>
             </div>
          )}

          <button onClick={addText} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600">Text</button>
          
          <div className="w-px h-6 bg-gray-700 mx-2"></div>
          
          <button onClick={handleUndo} disabled={history.length <= 1} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50">Undo</button>
          <button onClick={handleReset} disabled={history.length <= 1} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50">Reset</button>
        </div>
        
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500">Cancel</button>
          <button onClick={handleSave} className="px-4 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-500 font-bold">Save</button>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden bg-gray-800 p-4">
        <canvas ref={canvasRef} />
      </div>
    </div>,
    document.body
  );
};

export default ImageEditorModal;
