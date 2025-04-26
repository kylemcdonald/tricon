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

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid());
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    currentColor: 'black',
    triangleMode: null,
  });
  const [lastPosition, setLastPosition] = useState<{ row: number; col: number } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ row: number; col: number } | null>(null);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw grid
    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        const x = j * PIXEL_SIZE;
        const y = i * PIXEL_SIZE;

        // Draw pixel background
        ctx.fillStyle = pixel.color;
        ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);

        // Draw red overlay for hovered pixel
        if (hoverPosition && hoverPosition.row === i && hoverPosition.col === j) {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
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
  }, [grid, hoverPosition]);

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

    if (!drawingState.isDrawing || !lastPosition) return;
    if (!pos) return;

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

  const updatePixel = (row: number, col: number) => {
    setGrid(prev => {
      const newGrid = [...prev];
      const newRow = [...newGrid[row]];
      const newPixel: Pixel = {
        color: drawingState.triangleMode ? 'white' : drawingState.currentColor,
        ...(drawingState.triangleMode && {
          triangle: {
            orientation: drawingState.triangleMode,
            color: drawingState.currentColor,
          },
        }),
      };
      newRow[col] = newPixel;
      newGrid[row] = newRow;
      return newGrid;
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'x') {
      setDrawingState(prev => ({
        ...prev,
        currentColor: prev.currentColor === 'black' ? 'white' : 'black',
      }));
    } else if (e.key === 's') {
      setDrawingState(prev => ({ ...prev, triangleMode: 'top-left' }));
    } else if (e.key === 'a') {
      setDrawingState(prev => ({ ...prev, triangleMode: 'top-right' }));
    } else if (e.key === 'w') {
      setDrawingState(prev => ({ ...prev, triangleMode: 'bottom-left' }));
    } else if (e.key === 'q') {
      setDrawingState(prev => ({ ...prev, triangleMode: 'bottom-right' }));
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (['s', 'w', 'q', 'a'].includes(e.key)) {
      setDrawingState(prev => ({ ...prev, triangleMode: null }));
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, 'grid-drawing.png');
      }
    });
  }, []);

  const exportAsSVG = useCallback(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', `${CANVAS_SIZE}`);
    svg.setAttribute('height', `${CANVAS_SIZE}`);
    svg.setAttribute('viewBox', `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`);

    grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', `${j * PIXEL_SIZE}`);
        rect.setAttribute('y', `${i * PIXEL_SIZE}`);
        rect.setAttribute('width', `${PIXEL_SIZE}`);
        rect.setAttribute('height', `${PIXEL_SIZE}`);
        rect.setAttribute('fill', pixel.color);
        svg.appendChild(rect);

        if (pixel.triangle) {
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
    saveAs(blob, 'grid-drawing.svg');
  }, [grid]);

  const exportAsJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(grid)], { type: 'application/json' });
    saveAs(blob, 'grid-drawing.json');
  }, [grid]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
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
    }
  };

  return (
    <AppContainer onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}>
      <Controls>
        <Button onClick={exportAsPNG}>Export PNG</Button>
        <Button onClick={exportAsSVG}>Export SVG</Button>
        <Button onClick={exportAsJSON}>Export JSON</Button>
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <span>Current color:</span>
          <ColorIndicator color={drawingState.currentColor} />
        </div>
        <p>Press X to toggle color</p>
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