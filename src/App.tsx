import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Grid, Pixel, DrawingState, TriangleOrientation, PixelColor } from './types';
import { saveAs } from 'file-saver';

const GRID_SIZE = 26;
const PIXEL_SIZE = 12;
const CANVAS_SIZE = GRID_SIZE * PIXEL_SIZE;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  user-select: none;
`;

const CanvasContainer = styled.div`
  position: relative;
  margin: 20px;
  border: 1px solid #ccc;
  background: white;
`;

const Canvas = styled.canvas`
  display: block;
  cursor: none;
  width: ${CANVAS_SIZE}px;
  height: ${CANVAS_SIZE}px;
`;

const Controls = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
`;

const Button = styled.button`
  padding: 8px 16px;
  cursor: pointer;
`;

const ColorIndicator = styled.div.attrs<{ color: string }>(props => ({
  style: {
    backgroundColor: props.color,
  }
}))`
  width: 24px;
  height: 24px;
  border: 2px solid #333;
  margin: 0 10px;
`;

const TriangleLegend = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 10px;
  margin-top: 10px;
`;

const TriangleKey = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const TrianglePreview = styled.div.attrs<{ orientation: string, color: string }>(props => ({
  style: {
    clipPath: props.orientation === 'top-left' ? 'polygon(0 0, 0 100%, 100% 0)' :
              props.orientation === 'top-right' ? 'polygon(0 0, 100% 0, 100% 100%)' :
              props.orientation === 'bottom-left' ? 'polygon(0 0, 0 100%, 100% 100%)' :
              props.orientation === 'bottom-right' ? 'polygon(0 100%, 100% 0, 100% 100%)' : '',
    backgroundColor: props.color,
  }
}))`
  width: 16px;
  height: 16px;
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
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    triangleMode: null,
  });
  const [lastPosition, setLastPosition] = useState<{ row: number; col: number } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ row: number; col: number } | null>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

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
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw background image if exists
    if (backgroundImage) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(backgroundImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.globalAlpha = 1;
    }

    // Draw grid lines first
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * PIXEL_SIZE - 0.5, 0);
      ctx.lineTo(i * PIXEL_SIZE - 0.5, CANVAS_SIZE);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * PIXEL_SIZE - 0.5);
      ctx.lineTo(CANVAS_SIZE, i * PIXEL_SIZE - 0.5);
      ctx.stroke();
    }

    // Draw only black pixels on top
    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        const x = j * PIXEL_SIZE;
        const y = i * PIXEL_SIZE;

        // Only draw if the pixel is black
        if (pixel.color === 'black') {
          ctx.fillStyle = 'black';
          ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
        }

        // Draw triangle if present
        if (pixel.triangle) {
          ctx.fillStyle = pixel.triangle.color;
          ctx.beginPath();
          switch (pixel.triangle.orientation) {
            case 'top-left':
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + PIXEL_SIZE);
              ctx.lineTo(x + PIXEL_SIZE, y);
              break;
            case 'top-right':
              ctx.moveTo(x, y);
              ctx.lineTo(x + PIXEL_SIZE, y);
              ctx.lineTo(x + PIXEL_SIZE, y + PIXEL_SIZE);
              break;
            case 'bottom-left':
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + PIXEL_SIZE);
              ctx.lineTo(x + PIXEL_SIZE, y + PIXEL_SIZE);
              break;
            case 'bottom-right':
              ctx.moveTo(x + PIXEL_SIZE, y);
              ctx.lineTo(x, y + PIXEL_SIZE);
              ctx.lineTo(x + PIXEL_SIZE, y + PIXEL_SIZE);
              break;
          }
          ctx.closePath();
          ctx.fill();
        }
      });
    });

    // Draw hover overlay last
    if (hoverPosition) {
      const x = hoverPosition.col * PIXEL_SIZE;
      const y = hoverPosition.row * PIXEL_SIZE;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
    }
  }, [grid, hoverPosition, backgroundImage]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const col = Math.floor(x / PIXEL_SIZE);
    const row = Math.floor(y / PIXEL_SIZE);

    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) {
      return null;
    }

    return { row, col };
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

    setDrawingState(prev => ({ ...prev, isDrawing: true }));
    setLastPosition(pos);
    updatePixel(pos.row, pos.col);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);
    setHoverPosition(pos);

    if (!pos) return;

    if (pressedKeys.has('z')) {
      updatePixel(pos.row, pos.col, 'black');
    } else if (pressedKeys.has('x')) {
      updatePixel(pos.row, pos.col, 'white');
    } else if (pressedKeys.has('s')) {
      updatePixel(pos.row, pos.col, 'white', 'top-left');
    } else if (pressedKeys.has('a')) {
      updatePixel(pos.row, pos.col, 'white', 'top-right');
    } else if (pressedKeys.has('w')) {
      updatePixel(pos.row, pos.col, 'white', 'bottom-left');
    } else if (pressedKeys.has('q')) {
      updatePixel(pos.row, pos.col, 'white', 'bottom-right');
    }

    if (!drawingState.isDrawing || !lastPosition) return;
    drawLine(lastPosition.col, lastPosition.row, pos.col, pos.row);
    setLastPosition(pos);
  };

  const handleMouseUp = () => {
    setDrawingState(prev => ({ ...prev, isDrawing: false }));
    setLastPosition(null);
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
  };

  const updatePixel = (row: number, col: number, color: PixelColor = 'black', triangleMode: TriangleOrientation | null = null) => {
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
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (['z', 'x', 's', 'a', 'w', 'q'].includes(e.key)) {
      setPressedKeys(prev => new Set(prev).add(e.key));
      if (hoverPosition) {
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
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (['z', 'x', 's', 'a', 'w', 'q'].includes(e.key)) {
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key);
        return newSet;
      });
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hoverPosition, pressedKeys]);

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
    svg.setAttribute('width', `${CANVAS_SIZE}`);
    svg.setAttribute('height', `${CANVAS_SIZE}`);
    svg.setAttribute('viewBox', `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`);

    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        if (pixel.color === 'black') {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', `${j * PIXEL_SIZE}`);
          rect.setAttribute('y', `${i * PIXEL_SIZE}`);
          rect.setAttribute('width', `${PIXEL_SIZE}`);
          rect.setAttribute('height', `${PIXEL_SIZE}`);
          rect.setAttribute('fill', pixel.color);
          svg.appendChild(rect);
        }

        if (pixel.triangle && pixel.triangle.color === 'black') {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const points = {
            'top-left': `M${j * PIXEL_SIZE},${i * PIXEL_SIZE} L${j * PIXEL_SIZE},${(i + 1) * PIXEL_SIZE} L${(j + 1) * PIXEL_SIZE},${i * PIXEL_SIZE} Z`,
            'top-right': `M${j * PIXEL_SIZE},${i * PIXEL_SIZE} L${(j + 1) * PIXEL_SIZE},${i * PIXEL_SIZE} L${(j + 1) * PIXEL_SIZE},${(i + 1) * PIXEL_SIZE} Z`,
            'bottom-left': `M${j * PIXEL_SIZE},${i * PIXEL_SIZE} L${j * PIXEL_SIZE},${(i + 1) * PIXEL_SIZE} L${(j + 1) * PIXEL_SIZE},${(i + 1) * PIXEL_SIZE} Z`,
            'bottom-right': `M${(j + 1) * PIXEL_SIZE},${(i + 1) * PIXEL_SIZE} L${j * PIXEL_SIZE},${(i + 1) * PIXEL_SIZE} L${(j + 1) * PIXEL_SIZE},${i * PIXEL_SIZE} Z`,
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

  return (
    <AppContainer onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}>
      <Controls>
        <Button onClick={exportAsPNG}>Export PNG</Button>
        <Button onClick={exportAsSVG}>Export SVG</Button>
        <Button onClick={exportAsJSON}>Export JSON</Button>
        <Button onClick={exportAll}>Export All</Button>
        {backgroundImage && <Button onClick={clearBackground}>Clear Background</Button>}
      </Controls>
      <CanvasContainer>
        <Canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </CanvasContainer>
      <div>
        <p>Press Z to draw black, X to draw white</p>
        <TriangleLegend>
          <TriangleKey>
            <TrianglePreview orientation="bottom-right" color="black" />
            <span>Q</span>
          </TriangleKey>
          <TriangleKey>
            <TrianglePreview orientation="bottom-left" color="black" />
            <span>W</span>
          </TriangleKey>
          <TriangleKey>
            <TrianglePreview orientation="top-right" color="black" />
            <span>A</span>
          </TriangleKey>
          <TriangleKey>
            <TrianglePreview orientation="top-left" color="black" />
            <span>S</span>
          </TriangleKey>
        </TriangleLegend>
      </div>
    </AppContainer>
  );
};

export default App; 