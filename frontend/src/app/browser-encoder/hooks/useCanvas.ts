import { useRef, useCallback, useEffect } from 'react';
import { VideoSource, ResizeInfo } from '../types';

export const useCanvas = (
  videoSourcesRef: React.MutableRefObject<VideoSource[]>,
  setSelectedSourceId: (id: string | null) => void,
  selectedSourceId: string | null,
  setResizeInfo: (info: ResizeInfo | null) => void,
  drawOverlayCanvas: () => void
) => {
  const lastDrawTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const isTabVisibleRef = useRef<boolean>(true);
  const intervalIdRef = useRef<number | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Function to perform the actual canvas drawing
  const performCanvasDraw = useCallback(() => {
    const now = performance.now();
    if(now - lastDrawTimeRef.current < 33) {
      return;
    }
    lastDrawTimeRef.current = now;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const sourcesToDraw = [...videoSourcesRef.current].reverse();
  
    sourcesToDraw.forEach(source => {
      if (source.videoElement.readyState === 4) {
        try {
          if (source.crop) {
            ctx.drawImage(
              source.videoElement,
              source.crop.x,
              source.crop.y,
              source.crop.width,
              source.crop.height,
              source.x,
              source.y,
              source.width,
              source.height
            );
          } else {
            ctx.drawImage(source.videoElement, source.x, source.y, source.width, source.height);
          }
        } catch (error) {
          console.error('Error drawing video:', error);
        }
      }
    });
  }, [videoSourcesRef]);

  // Function to start interval-based rendering (for background tabs)
  const startIntervalRendering = useCallback(() => {
    if (intervalIdRef.current === null) {
      // Clear any existing animation frame
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      
      // Start interval-based rendering (30fps = ~33ms)
      intervalIdRef.current = window.setInterval(performCanvasDraw, 33);
      console.log('Switched to interval-based rendering for background tab');
    }
  }, [performCanvasDraw]);

  // Function to start requestAnimationFrame-based rendering (for active tabs)
  const startAnimationFrameRendering = useCallback(() => {
    // Clear any existing interval
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    
    // Start animation frame rendering
    const animationFrameLoop = () => {
      performCanvasDraw();
      animationFrameIdRef.current = requestAnimationFrame(animationFrameLoop);
    };
    
    animationFrameIdRef.current = requestAnimationFrame(animationFrameLoop);
    console.log('Switched to requestAnimationFrame rendering for active tab');
  }, [performCanvasDraw]);

  // Main drawing function that chooses the appropriate rendering method
  const drawCanvas = useCallback(() => {
    if (isTabVisibleRef.current) {
      startAnimationFrameRendering();
    } else {
      startIntervalRendering();
    }
  }, [startAnimationFrameRendering, startIntervalRendering]);

  // Set up visibility change detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
      drawCanvas();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Clean up any ongoing rendering
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
      }
      
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [drawCanvas]);

  const drawOverlay = useCallback((overlayCtx: CanvasRenderingContext2D, source: VideoSource) => {
    if (source.id === selectedSourceId) {
      const handleSize = 10;

      if (source.isCropping) {
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        overlayCtx.fillRect(0, 0, overlayCanvasRef.current!.width, overlayCanvasRef.current!.height);
        overlayCtx.clearRect(source.x, source.y, source.width, source.height);
      }
  
      overlayCtx.strokeStyle = source.isCropping ? '#ffffff' : '#00ff00';
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(source.x, source.y, source.width, source.height);
  
      if (source.isCropping) {
        overlayCtx.setLineDash([5, 5]);
        overlayCtx.beginPath();
        overlayCtx.moveTo(source.x + source.width / 3, source.y);
        overlayCtx.lineTo(source.x + source.width / 3, source.y + source.height);
        overlayCtx.moveTo(source.x + (source.width * 2) / 3, source.y);
        overlayCtx.lineTo(source.x + (source.width * 2) / 3, source.y + source.height);
        overlayCtx.moveTo(source.x, source.y + source.height / 3);
        overlayCtx.lineTo(source.x + source.width, source.y + source.height / 3);
        overlayCtx.moveTo(source.x, source.y + (source.height * 2) / 3);
        overlayCtx.lineTo(source.x + source.width, source.y + (source.height * 2) / 3);
        overlayCtx.stroke();
        overlayCtx.setLineDash([]);
  
        const corners = [
          { x: source.x, y: source.y },
          { x: source.x + source.width, y: source.y },
          { x: source.x, y: source.y + source.height },
          { x: source.x + source.width, y: source.y + source.height }
        ];
  
        overlayCtx.fillStyle = 'white';
        corners.forEach(corner => {
          overlayCtx.fillRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
          overlayCtx.strokeRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
        });
      }
  
      overlayCtx.fillRect(
        source.x + source.width - 15,
        source.y + source.height - 15,
        15,
        15
      );
    }
  }, [selectedSourceId]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    const scaleX = overlayCanvasRef.current!.width / rect.width;
    const scaleY = overlayCanvasRef.current!.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const sources = [...videoSourcesRef.current]
      .sort((a, b) => videoSourcesRef.current.length - 1 - videoSourcesRef.current.findIndex(s => s.id === b.id) - (videoSourcesRef.current.length - 1 - videoSourcesRef.current.findIndex(s => s.id === a.id)));

    let found = false;
    for (const source of sources) {
      const handleSize = 10;
      
      const isNearLeftEdge = Math.abs(x - source.x) <= handleSize;
      const isNearRightEdge = Math.abs(x - (source.x + source.width)) <= handleSize;
      const isNearTopEdge = Math.abs(y - source.y) <= handleSize;
      const isNearBottomEdge = Math.abs(y - (source.y + source.height)) <= handleSize;
      const isWithinVerticalBounds = y >= source.y && y <= source.y + source.height;
      const isWithinHorizontalBounds = x >= source.x && x <= source.x + source.width;

      const isOnCornerHandle = 
        x >= source.x + source.width - 15 &&
        x <= source.x + source.width &&
        y >= source.y + source.height - 15 &&
        y <= source.y + source.height;

      if (source.id === selectedSourceId && source.isCropping) {
        if (isNearLeftEdge && isWithinVerticalBounds) {
          setResizeInfo({
            sourceId: source.id,
            type: 'crop',
            edge: 'left',
            startX: x,
            startY: y,
            startWidth: source.crop?.width || source.width,
            startHeight: source.crop?.height || source.height,
            originalX: source.crop?.x || 0,
            originalY: source.crop?.y || 0
          });
          found = true;
          break;
        } else if (isNearRightEdge && isWithinVerticalBounds) {
          setResizeInfo({
            sourceId: source.id,
            type: 'crop',
            edge: 'right',
            startX: x,
            startY: y,
            startWidth: source.crop?.width || source.width,
            startHeight: source.crop?.height || source.height,
            originalX: source.crop?.x || 0,
            originalY: source.crop?.y || 0
          });
          found = true;
          break;
        } else if (isNearTopEdge && isWithinHorizontalBounds) {
          setResizeInfo({
            sourceId: source.id,
            type: 'crop',
            edge: 'top',
            startX: x,
            startY: y,
            startWidth: source.crop?.width || source.width,
            startHeight: source.crop?.height || source.height,
            originalX: source.crop?.x || 0,
            originalY: source.crop?.y || 0
          });
          found = true;
          break;
        } else if (isNearBottomEdge && isWithinHorizontalBounds) {
          setResizeInfo({
            sourceId: source.id,
            type: 'crop',
            edge: 'bottom',
            startX: x,
            startY: y,
            startWidth: source.crop?.width || source.width,
            startHeight: source.crop?.height || source.height,
            originalX: source.crop?.x || 0,
            originalY: source.crop?.y || 0
          });
          found = true;
          break;
        }
      }

      if (isOnCornerHandle) {
        setResizeInfo({
          sourceId: source.id,
          type: 'resize',
          edge: 'corner',
          startX: x,
          startY: y,
          startWidth: source.width,
          startHeight: source.height
        });
        found = true;
        break;
      }

      if (x >= source.x && x <= source.x + source.width &&
          y >= source.y && y <= source.y + source.height) {
        setSelectedSourceId(source.id);
        setResizeInfo({
          sourceId: source.id,
          type: 'move',
          startX: x - source.x,
          startY: y - source.y,
          startWidth: source.width,
          startHeight: source.height
        });
        found = true;
        break;
      }
    }

    if (!found) {
      setSelectedSourceId(null);
    }
    drawOverlayCanvas();
  }, [selectedSourceId, setSelectedSourceId, setResizeInfo, drawOverlayCanvas]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>, resizeInfo: ResizeInfo | null) => {
    if (!resizeInfo) return;

    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    const scaleX = overlayCanvasRef.current!.width / rect.width;
    const scaleY = overlayCanvasRef.current!.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const source = videoSourcesRef.current.find(s => s.id === resizeInfo.sourceId);
    if (!source) return;

    if (resizeInfo.type === 'crop' && source.originalDimensions) {
      const maxWidth = source.originalDimensions.width;
      const maxHeight = source.originalDimensions.height;

      const deltaX = x - resizeInfo.startX;
      const deltaY = y - resizeInfo.startY;

      let newCrop = { ...source.crop! };

      switch (resizeInfo.edge) {
        case 'left':
          const newLeftX = Math.max(0, Math.min(resizeInfo.originalX! + deltaX, maxWidth));
          newCrop = {
            ...newCrop,
            x: newLeftX,
            width: resizeInfo.startWidth - (newLeftX - source.crop!.x)
          };
          newCrop.height = newCrop.width / source.cropAspectRatio!;
          break;
        case 'right':
          newCrop = {
            ...newCrop,
            width: Math.min(maxWidth - source.crop!.x, Math.max(100, resizeInfo.startWidth + deltaX))
          };
          newCrop.height = newCrop.width / source.cropAspectRatio!;
          break;
        case 'top':
          const newTopY = Math.max(0, Math.min(resizeInfo.originalY! + deltaY, maxHeight));
          newCrop = {
            ...newCrop,
            y: newTopY,
            height: resizeInfo.startHeight - (newTopY - source.crop!.y)
          };
          newCrop.width = newCrop.height * source.cropAspectRatio!;
          break;
        case 'bottom':
          newCrop = {
            ...newCrop,
            height: Math.min(maxHeight - source.crop!.y, Math.max(100, resizeInfo.startHeight + deltaY))
          };
          newCrop.width = newCrop.height * source.cropAspectRatio!;
          break;
      }

      if (newCrop.x >= 0 && newCrop.y >= 0 &&
          newCrop.x + newCrop.width <= maxWidth &&
          newCrop.y + newCrop.height <= maxHeight &&
          newCrop.width >= 100 && newCrop.height >= 100) {
        source.crop = newCrop;
      }
    } else if (resizeInfo.type === 'resize') {
      const newWidth = Math.max(100, resizeInfo.startWidth + (x - resizeInfo.startX));
      if (source.originalAspectRatio) {
        source.width = newWidth;
        source.height = newWidth / source.originalAspectRatio;
      } else {
        source.width = newWidth;
        source.height = Math.max(100, resizeInfo.startHeight + (y - resizeInfo.startY));
      }
    } else if (resizeInfo.type === 'move') {
      source.x = x - resizeInfo.startX;
      source.y = y - resizeInfo.startY;
    }

    drawCanvas();
    drawOverlayCanvas();
  }, [drawCanvas, drawOverlayCanvas]);

  const updateCursor = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    const scaleX = overlayCanvasRef.current!.width / rect.width;
    const scaleY = overlayCanvasRef.current!.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const source = videoSourcesRef.current.find(s => s.id === selectedSourceId);
    if (!source) {
      e.currentTarget.style.cursor = 'default';
      return;
    }

    const handleSize = 10;
    const isNearLeftEdge = Math.abs(x - source.x) <= handleSize;
    const isNearRightEdge = Math.abs(x - (source.x + source.width)) <= handleSize;
    const isNearTopEdge = Math.abs(y - source.y) <= handleSize;
    const isNearBottomEdge = Math.abs(y - (source.y + source.height)) <= handleSize;
    const isWithinVerticalBounds = y >= source.y && y <= source.y + source.height;
    const isWithinHorizontalBounds = x >= source.x && x <= source.x + source.width;

    if (source.isCropping) {
      if ((isNearLeftEdge && isWithinVerticalBounds) || (isNearRightEdge && isWithinVerticalBounds)) {
        e.currentTarget.style.cursor = 'ew-resize';
      } else if ((isNearTopEdge && isWithinHorizontalBounds) || (isNearBottomEdge && isWithinHorizontalBounds)) {
        e.currentTarget.style.cursor = 'ns-resize';
      } else {
        e.currentTarget.style.cursor = 'move';
      }
    } else {
      e.currentTarget.style.cursor = 'move';
    }
  }, [selectedSourceId]);

  return {
    canvasRef,
    overlayCanvasRef,
    drawCanvas,
    drawOverlay,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    updateCursor
  };
};
