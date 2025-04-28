import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Grid, PixelState, DrawingState, HoverRegion } from './types';
import { saveAs } from 'file-saver';

class GridManager {
  private grid: Grid;
  private onChange: (grid: Grid) => void;

  constructor(initialGrid: Grid, onChange: (grid: Grid) => void) {
    this.grid = initialGrid;
    this.onChange = onChange;
  }

  updatePixel(row: number, col: number, state: PixelState = 'black') {
    const newGrid = this.grid.map(row => [...row]);
    newGrid[row][col] = state;
    this.grid = newGrid;
    this.onChange(newGrid);
  }

  getGrid(): Grid {
    return this.grid.map(row => [...row]);
  }

  setGrid(newGrid: Grid) {
    this.grid = newGrid.map(row => [...row]);
    this.onChange(this.grid);
  }
}

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

interface CanvasContainerProps {
  width: number;
  height: number;
}

const CanvasContainer = styled.div<CanvasContainerProps>`
  position: relative;
  border: 1px solid #ccc;
  background: white;
  margin: 0 auto;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
`;

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  cursor: none;
  width: 100%;
  height: 100%;
`;

const Button = styled.button`
  padding: 8px 16px;
  cursor: pointer;
`;

const createEmptyGrid = (): Grid => {
  return Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill(null).map(() => 'clear')
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

const bresenhamLine = (x0: number, y0: number, x1: number, y1: number, callback: (x: number, y: number) => void) => {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    callback(x0, y0);
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

const App: React.FC = () => {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid());
  const gridManagerRef = useRef<GridManager | null>(null);
  const setGridRef = useRef(setGrid);
  setGridRef.current = setGrid;
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [pixelSize, setPixelSize] = useState<number>(32);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    hoverRegion: null
  });
  const [drawingMode, setDrawingMode] = useState<PixelState>('black');
  const [lastPosition, setLastPosition] = useState<{ row: number; col: number; region: HoverRegion } | null>(null);
  const [previousPosition, setPreviousPosition] = useState<{ row: number; col: number; region: HoverRegion } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ row: number; col: number; region: HoverRegion } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [keyboardPosition, setKeyboardPosition] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    gridManagerRef.current = new GridManager(grid, (newGrid) => setGridRef.current(newGrid));
  }, []);

  useEffect(() => {
    if (gridManagerRef.current) {
      const currentGrid = gridManagerRef.current.getGrid();
      if (JSON.stringify(currentGrid) !== JSON.stringify(grid)) {
        gridManagerRef.current.setGrid(grid);
      }
    }
  }, [grid]);

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

  const drawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
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

    // Draw grid lines
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;

    // Draw vertical lines
    ctx.beginPath();
    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = i * pixelSize - 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize);
    }
    ctx.stroke();

    // Draw horizontal lines
    ctx.beginPath();
    for (let i = 0; i <= GRID_SIZE; i++) {
      const y = i * pixelSize - 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(canvasSize, y);
    }
    ctx.stroke();

    // Draw diagonal X-shaped grid within each cell
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    // Draw diagonal from top-left to bottom-right
    ctx.beginPath();
    for (let i = 0; i < GRID_SIZE; i++) {
      const x = i * pixelSize;
      const y = 0;
      ctx.moveTo(x, y);
      ctx.lineTo(x + pixelSize * GRID_SIZE, y + pixelSize * GRID_SIZE);
    }
    ctx.stroke();

    // Draw diagonal from top-right to bottom-left
    ctx.beginPath();
    for (let i = 0; i < GRID_SIZE; i++) {
      const x = i * pixelSize;
      const y = 0;
      ctx.moveTo(x + pixelSize, y);
      ctx.lineTo(x - pixelSize * (GRID_SIZE - 1), y + pixelSize * GRID_SIZE);
    }
    ctx.stroke();

    // Draw diagonal from top-left to bottom-right (vertical)
    ctx.beginPath();
    for (let i = 0; i < GRID_SIZE; i++) {
      const x = 0;
      const y = i * pixelSize;
      ctx.moveTo(x, y);
      ctx.lineTo(x + pixelSize * GRID_SIZE, y + pixelSize * GRID_SIZE);
    }
    ctx.stroke();

    // Draw diagonal from top-right to bottom-left (vertical)
    ctx.beginPath();
    for (let i = 0; i < GRID_SIZE; i++) {
      const x = pixelSize * GRID_SIZE;
      const y = i * pixelSize;
      ctx.moveTo(x, y);
      ctx.lineTo(x - pixelSize * GRID_SIZE, y + pixelSize * GRID_SIZE);
    }
    ctx.stroke();

    // Draw grid content
    ctx.fillStyle = 'black';
    
    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        const x = j * pixelSize;
        const y = i * pixelSize;

        if (pixel === 'black') {
          ctx.fillRect(x, y, pixelSize, pixelSize);
        } else if (pixel !== 'clear') {
          ctx.beginPath();
          switch (pixel) {
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
  }, [grid, backgroundImage, pixelSize, canvasSize]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear overlay canvas
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Draw hover overlay
    if (hoverPosition) {
      const x = hoverPosition.col * pixelSize;
      const y = hoverPosition.row * pixelSize;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';

      // If we're in drawing mode or a key is pressed, use the drawing mode's region
      const region = drawingState.isDrawing ? drawingMode : hoverPosition.region;

      if (region === 'black' || region === 'center' || region === 'clear') {
        ctx.fillRect(x, y, pixelSize, pixelSize);
      } else {
        ctx.beginPath();
        switch (region) {
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
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(mousePosition.x, mousePosition.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [hoverPosition, mousePosition, pixelSize, canvasSize, drawingState.isDrawing, drawingMode]);

  useEffect(() => {
    drawBase();
  }, [drawBase]);

  useEffect(() => {
    const animate = () => {
      drawOverlay();
      requestAnimationFrame(animate);
    };
    
    const frameId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [drawOverlay]);

  const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = baseCanvasRef.current;
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);
    if (!pos) return;

    setDrawingState(prev => ({ ...prev, isDrawing: true, hoverRegion: pos.region }));
    setLastPosition(pos);
    setPreviousPosition(pos);
    setHoverPosition(pos);

    let state: PixelState;
    if (pos.region === 'center') {
      state = 'black';
    } else {
      state = pos.region;
    }
    updatePixel(pos.row, pos.col, state);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePosition({ x, y });

    const pos = getMousePosition(e);
    if (!pos) return;

    if (drawingState.isDrawing && previousPosition) {
      setHoverPosition({ ...pos, region: lastPosition?.region || pos.region });
      
      let state: PixelState;
      if (lastPosition?.region === 'center') {
        state = 'black';
      } else {
        state = (lastPosition?.region || pos.region) as PixelState;
      }

      // Use Bresenham's line algorithm to draw between consecutive points
      bresenhamLine(
        previousPosition.col,
        previousPosition.row,
        pos.col,
        pos.row,
        (x, y) => {
          if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            updatePixel(y, x, state);
          }
        }
      );
      setPreviousPosition(pos);
    } else {
      setHoverPosition(pos);
    }
  };

  const handleMouseUp = () => {
    setDrawingState(prev => ({ ...prev, isDrawing: false }));
    setLastPosition(null);
    setPreviousPosition(null);
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
    setMousePosition(null);
  };

  const updatePixel = useCallback((row: number, col: number, state: PixelState = 'black') => {
    gridManagerRef.current?.updatePixel(row, col, state);
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (drawingState.isDrawing) {
        handleMouseUp();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hoverPosition) return;
      
      const key = e.key.toLowerCase();
      let mode: PixelState | null = null;
      
      switch (key) {
        case 'z':
          mode = 'black';
          break;
        case 'x':
          mode = 'clear';
          break;
        case 'q':
          mode = 'bottom-right';
          break;
        case 'w':
          mode = 'bottom-left';
          break;
        case 'a':
          mode = 'top-right';
          break;
        case 's':
          mode = 'top-left';
          break;
      }

      if (mode !== null) {
        setDrawingState(prev => ({ ...prev, isDrawing: true }));
        setDrawingMode(mode);
        setKeyboardPosition({ row: hoverPosition.row, col: hoverPosition.col });
        updatePixel(hoverPosition.row, hoverPosition.col, mode);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['z', 'x', 'q', 'w', 'a', 's'].includes(key)) {
        setDrawingState(prev => ({ ...prev, isDrawing: false }));
        setKeyboardPosition(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (drawingState.isDrawing && keyboardPosition && hoverPosition) {
        bresenhamLine(
          keyboardPosition.col,
          keyboardPosition.row,
          hoverPosition.col,
          hoverPosition.row,
          (x, y) => {
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
              updatePixel(y, x, drawingMode);
            }
          }
        );
        setKeyboardPosition({ row: hoverPosition.row, col: hoverPosition.col });
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [drawingState.isDrawing, hoverPosition, keyboardPosition, updatePixel, drawingMode]);

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

    // Draw elements
    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        const x = j * 32;
        const y = i * 32;

        if (pixel === 'black') {
          ctx.fillStyle = 'black';
          ctx.fillRect(x, y, 32, 32);
        } else if (pixel !== 'clear') {
          ctx.fillStyle = 'black';
          ctx.beginPath();
          switch (pixel) {
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
        if (pixel === 'black') {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', `${j * EXPORT_PIXEL_SIZE}`);
          rect.setAttribute('y', `${i * EXPORT_PIXEL_SIZE}`);
          rect.setAttribute('width', `${EXPORT_PIXEL_SIZE}`);
          rect.setAttribute('height', `${EXPORT_PIXEL_SIZE}`);
          rect.setAttribute('fill', 'black');
          svg.appendChild(rect);
        } else if (pixel !== 'clear') {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const points = {
            'top-left': `M${j * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} L${j * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} Z`,
            'top-right': `M${j * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} Z`,
            'bottom-left': `M${j * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} L${j * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} Z`,
            'bottom-right': `M${(j + 1) * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} L${j * EXPORT_PIXEL_SIZE},${(i + 1) * EXPORT_PIXEL_SIZE} L${(j + 1) * EXPORT_PIXEL_SIZE},${i * EXPORT_PIXEL_SIZE} Z`,
          };
          path.setAttribute('d', points[pixel]);
          path.setAttribute('fill', 'black');
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
    const exportData = {
      version: 1,
      grid: grid
    };
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
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
            const loadedData = JSON.parse(event.target?.result as string);
            const loadedGrid = loadedData.version === 1 ? loadedData.grid : loadedData;
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
    const newGrid = grid.map(row =>
      row.map(pixel => {
        if (pixel === 'clear') {
          return 'black';
        } else if (pixel === 'black') {
          return 'clear';
        } else {
          const inverted = {
            'top-left': 'bottom-right',
            'top-right': 'bottom-left',
            'bottom-left': 'top-right',
            'bottom-right': 'top-left'
          }[pixel];
          return inverted as PixelState;
        }
      })
    );
    if (gridManagerRef.current) {
      gridManagerRef.current.setGrid(newGrid);
    }
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
      <CanvasContainer width={canvasSize} height={canvasSize}>
        <Canvas
          ref={baseCanvasRef}
          width={canvasSize}
          height={canvasSize}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        <Canvas
          ref={overlayCanvasRef}
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