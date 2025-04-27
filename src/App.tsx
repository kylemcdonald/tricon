import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Grid, Pixel, DrawingState, TriangleOrientation, PixelColor, HoverRegion } from './types';
import { saveAs } from 'file-saver';

const GRID_SIZE = 26;
const EXPORT_PIXEL_SIZE = 12;

const AppContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 0 20px;
  user-select: none;
  gap: 20px;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 150px;
  position: fixed;
  left: 20px;
  top: 20px;
`;

const CanvasContainer = styled.div`
  position: relative;
  border: 1px solid #ccc;
  background: white;
  margin: 0 auto;
`;

const Canvas = styled.canvas`
  display: block;
  cursor: none;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
`;

const Button = styled.button`
  padding: 8px 16px;
  cursor: pointer;
`;

const createEmptyGrid = (): Grid => {
  return Array(GRID_SIZE).fill(null).map(() => 
    Array(GRID_SIZE).fill(null).map(() => ({ color: 'white' }))
  );
};

const generateHash = (content: any): string => {
  const str = JSON.stringify(content);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid());
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [pixelSize, setPixelSize] = useState<number>(32);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    triangleMode: null,
    hoverRegion: null,
  });
  const [lastPosition, setLastPosition] = useState<{ row: number; col: number; region: HoverRegion } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ row: number; col: number; region: HoverRegion } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const updatePixelSize = () => {
      const windowHeight = window.innerHeight;
      const newPixelSize = Math.floor((windowHeight - 100) / GRID_SIZE);
      setPixelSize(newPixelSize);
    };

    updatePixelSize();
    window.addEventListener('resize', updatePixelSize);
    return () => window.removeEventListener('resize', updatePixelSize);
  }, []);

  const canvasSize = GRID_SIZE * pixelSize;

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw background image if exists
    if (backgroundImage) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(backgroundImage, 0, 0, canvasSize, canvasSize);
      ctx.globalAlpha = 1;
    }

    // Draw grid lines first
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * pixelSize - 0.5, 0);
      ctx.lineTo(i * pixelSize - 0.5, canvasSize);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * pixelSize - 0.5);
      ctx.lineTo(canvasSize, i * pixelSize - 0.5);
      ctx.stroke();
    }

    // Draw diagonal X-shaped grid within each cell
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const x = j * pixelSize;
        const y = i * pixelSize;

        // Draw diagonal from top-left to bottom-right
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + pixelSize, y + pixelSize);
        ctx.stroke();

        // Draw diagonal from top-right to bottom-left
        ctx.beginPath();
        ctx.moveTo(x + pixelSize, y);
        ctx.lineTo(x, y + pixelSize);
        ctx.stroke();
      }
    }

    // Draw only black pixels on top
    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        const x = j * pixelSize;
        const y = i * pixelSize;

        // Only draw if the pixel is black
        if (pixel.color === 'black') {
          ctx.fillStyle = 'black';
          ctx.fillRect(x, y, pixelSize, pixelSize);
        }

        // Draw triangle if present
        if (pixel.triangle) {
          ctx.fillStyle = pixel.triangle.color;
          ctx.beginPath();
          switch (pixel.triangle.orientation) {
            case 'top-left':
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + pixelSize);
              ctx.lineTo(x + pixelSize, y);
              break;
            case 'top-right':
              ctx.moveTo(x, y);
              ctx.lineTo(x + pixelSize, y);
              ctx.lineTo(x + pixelSize, y + pixelSize);
              break;
            case 'bottom-left':
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + pixelSize);
              ctx.lineTo(x + pixelSize, y + pixelSize);
              break;
            case 'bottom-right':
              ctx.moveTo(x + pixelSize, y);
              ctx.lineTo(x, y + pixelSize);
              ctx.lineTo(x + pixelSize, y + pixelSize);
              break;
          }
          ctx.closePath();
          ctx.fill();
        }
      });
    });

    // Draw hover overlay last
    if (hoverPosition) {
      const x = hoverPosition.col * pixelSize;
      const y = hoverPosition.row * pixelSize;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      
      if (hoverPosition.region === 'center') {
        ctx.fillRect(x, y, pixelSize, pixelSize);
      } else {
        ctx.beginPath();
        switch (hoverPosition.region) {
          case 'top-left':
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + pixelSize);
            ctx.lineTo(x + pixelSize, y);
            break;
          case 'top-right':
            ctx.moveTo(x, y);
            ctx.lineTo(x + pixelSize, y);
            ctx.lineTo(x + pixelSize, y + pixelSize);
            break;
          case 'bottom-left':
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + pixelSize);
            ctx.lineTo(x + pixelSize, y + pixelSize);
            break;
          case 'bottom-right':
            ctx.moveTo(x + pixelSize, y);
            ctx.lineTo(x, y + pixelSize);
            ctx.lineTo(x + pixelSize, y + pixelSize);
            break;
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw cursor dot
    if (mousePosition) {
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(mousePosition.x, mousePosition.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [grid, hoverPosition, backgroundImage, pixelSize, mousePosition, canvasSize]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const col = Math.floor(x / pixelSize);
    const row = Math.floor(y / pixelSize);

    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) {
      return null;
    }

    // Calculate relative position within the cell
    const cellX = (x % pixelSize) / pixelSize;
    const cellY = (y % pixelSize) / pixelSize;

    // Determine which region the mouse is in
    let region: HoverRegion;
    if (cellX + cellY < 0.5) {
      region = 'top-left';
    } else if (cellX + cellY > 1.5) {
      region = 'bottom-right';
    } else if (cellX - cellY > 0.5) {
      region = 'top-right';
    } else if (cellY - cellX > 0.5) {
      region = 'bottom-left';
    } else {
      region = 'center';
    }

    return { row, col, region };
  };

  const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      updatePixel(y0, x0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);
    if (!pos) return;

    setDrawingState(prev => ({ ...prev, isDrawing: true, hoverRegion: pos.region }));
    setLastPosition(pos);
    setHoverPosition(pos);
    
    if (pos.region === 'center') {
      updatePixel(pos.row, pos.col, 'black');
    } else {
      updatePixel(pos.row, pos.col, 'white', pos.region);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePosition({ x, y });

    const pos = getMousePosition(e);
    
    // Update hover position based on pressed keys
    if (pos) {
      if (drawingState.isDrawing && lastPosition) {
        setHoverPosition({ ...pos, region: lastPosition.region });
      } else {
        let region: HoverRegion = pos.region;
        if (pressedKeys.has('z') || pressedKeys.has('x')) {
          region = 'center';
        } else if (pressedKeys.has('q')) {
          region = 'bottom-right';
        } else if (pressedKeys.has('w')) {
          region = 'bottom-left';
        } else if (pressedKeys.has('a')) {
          region = 'top-right';
        } else if (pressedKeys.has('s')) {
          region = 'top-left';
        }
        setHoverPosition({ ...pos, region });
      }
    }
    
    drawGrid();

    if (!pos) return;

    if (drawingState.isDrawing && lastPosition) {
      if (lastPosition.region === 'center') {
        updatePixel(pos.row, pos.col, 'black');
      } else {
        updatePixel(pos.row, pos.col, 'white', lastPosition.region);
      }
    }
  };

  const handleMouseUp = () => {
    setDrawingState(prev => ({ ...prev, isDrawing: false }));
    setLastPosition(null);
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
    setMousePosition(null);
  };

  const updatePixel = useCallback((row: number, col: number, color: PixelColor = 'black', triangleMode: TriangleOrientation | null = null) => {
    setGrid(prev => {
      const newGrid = [...prev];
      const newRow = [...newGrid[row]];
      const newPixel: Pixel = {
        color: triangleMode ? 'white' : color,
        ...(triangleMode && {
          triangle: {
            orientation: triangleMode,
            color: 'black',
          },
        }),
      };
      newRow[col] = newPixel;
      newGrid[row] = newRow;
      return newGrid;
    });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['z', 'x', 's', 'a', 'w', 'q'].includes(e.key)) {
      setPressedKeys(prev => new Set(prev).add(e.key));
      if (hoverPosition) {
        let region: HoverRegion;
        if (e.key === 'z' || e.key === 'x') {
          region = 'center';
        } else if (e.key === 'q') {
          region = 'bottom-right';
        } else if (e.key === 'w') {
          region = 'bottom-left';
        } else if (e.key === 'a') {
          region = 'top-right';
        } else if (e.key === 's') {
          region = 'top-left';
        } else {
          region = hoverPosition.region;
        }
        setHoverPosition({ ...hoverPosition, region });

        if (e.key === 'z') {
          updatePixel(hoverPosition.row, hoverPosition.col, 'black');
        } else if (e.key === 'x') {
          updatePixel(hoverPosition.row, hoverPosition.col, 'white');
        } else if (e.key === 's') {
          updatePixel(hoverPosition.row, hoverPosition.col, 'white', 'top-left');
        } else if (e.key === 'a') {
          updatePixel(hoverPosition.row, hoverPosition.col, 'white', 'top-right');
        } else if (e.key === 'w') {
          updatePixel(hoverPosition.row, hoverPosition.col, 'white', 'bottom-left');
        } else if (e.key === 'q') {
          updatePixel(hoverPosition.row, hoverPosition.col, 'white', 'bottom-right');
        }
      }
    }
  }, [hoverPosition, updatePixel]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (['z', 'x', 's', 'a', 'w', 'q'].includes(e.key)) {
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key);
        return newSet;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (drawingState.isDrawing) {
        handleMouseUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [drawingState.isDrawing]);

  const exportAsPNG = useCallback(() => {
    const hash = generateHash(grid);
    const exportCanvas = document.createElement('canvas');
    const exportSize = GRID_SIZE * 32;
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, exportSize, exportSize);

    // Draw black elements
    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        const x = j * 32;
        const y = i * 32;

        if (pixel.color === 'black') {
          ctx.fillStyle = 'black';
          ctx.fillRect(x, y, 32, 32);
        }

        if (pixel.triangle && pixel.triangle.color === 'black') {
          ctx.fillStyle = 'black';
          ctx.beginPath();
          switch (pixel.triangle.orientation) {
            case 'top-left':
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + 32);
              ctx.lineTo(x + 32, y);
              break;
            case 'top-right':
              ctx.moveTo(x, y);
              ctx.lineTo(x + 32, y);
              ctx.lineTo(x + 32, y + 32);
              break;
            case 'bottom-left':
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + 32);
              ctx.lineTo(x + 32, y + 32);
              break;
            case 'bottom-right':
              ctx.moveTo(x + 32, y);
              ctx.lineTo(x, y + 32);
              ctx.lineTo(x + 32, y + 32);
              break;
          }
          ctx.closePath();
          ctx.fill();
        }
      });
    });

    exportCanvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, `${hash}.png`);
      }
    });
  }, [grid]);

  const exportAsSVG = useCallback(() => {
    const hash = generateHash(grid);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const exportSize = GRID_SIZE * EXPORT_PIXEL_SIZE;
    svg.setAttribute('width', `${exportSize}`);
    svg.setAttribute('height', `${exportSize}`);
    svg.setAttribute('viewBox', `0 0 ${exportSize} ${exportSize}`);

    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        if (pixel.color === 'black') {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', `${j * EXPORT_PIXEL_SIZE}`);
          rect.setAttribute('y', `${i * EXPORT_PIXEL_SIZE}`);
          rect.setAttribute('width', `${EXPORT_PIXEL_SIZE}`);
          rect.setAttribute('height', `${EXPORT_PIXEL_SIZE}`);
          rect.setAttribute('fill', pixel.color);
          svg.appendChild(rect);
        }

        if (pixel.triangle && pixel.triangle.color === 'black') {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const points = {
            'top-left': `M${j * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} L${j * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} Z`,
            'top-right': `M${j * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} Z`,
            'bottom-left': `M${j * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} L${j * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} Z`,
            'bottom-right': `M${(j + 1) * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} L${j * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} Z`,
          };
          path.setAttribute('d', points[pixel.triangle.orientation]);
          path.setAttribute('fill', pixel.triangle.color);
          svg.appendChild(path);
        }
      });
    });

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    saveAs(blob, `${hash}.svg`);
  }, [grid]);

  const exportAsJSON = useCallback(() => {
    const hash = generateHash(grid);
    const blob = new Blob([JSON.stringify(grid)], { type: 'application/json' });
    saveAs(blob, `${hash}.json`);
  }, [grid]);

  const exportAll = useCallback(() => {
    exportAsPNG();
    exportAsSVG();
    exportAsJSON();
  }, [exportAsPNG, exportAsSVG, exportAsJSON]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const loadedGrid = JSON.parse(event.target?.result as string);
            setGrid(loadedGrid);
          } catch (error) {
            console.error('Error loading file:', error);
          }
        };
        reader.readAsText(file);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            setBackgroundImage(img);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const clearBackground = () => {
    setBackgroundImage(null);
  };

  const invertPixels = () => {
    setGrid(prev => prev.map(row => 
      row.map(pixel => ({
        ...pixel,
        color: pixel.color === 'black' ? 'white' : 'black',
        ...(pixel.triangle && {
          triangle: {
            ...pixel.triangle,
            color: pixel.triangle.color === 'black' ? 'white' : 'black'
          }
        })
      }))
    ));
  };

  return (
    <AppContainer onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}>
      <Controls>
        <Button onClick={exportAsPNG}>Export PNG</Button>
        <Button onClick={exportAsSVG}>Export SVG</Button>
        <Button onClick={exportAsJSON}>Export JSON</Button>
        <Button onClick={exportAll}>Export All</Button>
        {backgroundImage && <Button onClick={clearBackground}>Clear Background</Button>}
        <Button onClick={invertPixels}>Invert Colors</Button>
      </Controls>
      <CanvasContainer>
        <Canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </CanvasContainer>
    </AppContainer>
  );
};

export default App; 