import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Grid, Pixel, DrawingState, TriangleOrientation, PixelColor } from './types';
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';

const GRID_SIZE = 26;
const PIXEL_SIZE = 12;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  user-select: none;
`;

const GridContainer = styled.div<{ $isDrawing: boolean }>`
  display: grid;
  grid-template-columns: repeat(${GRID_SIZE}, ${PIXEL_SIZE}px);
  grid-template-rows: repeat(${GRID_SIZE}, ${PIXEL_SIZE}px);
  border: 1px solid #ccc;
  margin: 20px;
  background: white;
  user-select: none;
  position: relative;
  gap: 1px;
  background-color: #eee;
  padding: 1px;
`;

const PixelElement = styled.div.attrs<{ color: string }>(props => ({
  style: {
    backgroundColor: props.color,
  }
}))`
  width: ${PIXEL_SIZE}px;
  height: ${PIXEL_SIZE}px;
  position: relative;
  user-select: none;
  box-sizing: border-box;
  cursor: none;
  * {
    cursor: none;
  }
`;

const Triangle = styled.div.attrs<{ orientation: string, color: string }>(props => ({
  style: {
    clipPath: props.orientation === 'top-left' ? 'polygon(0 0, 0 100%, 100% 0)' :
              props.orientation === 'top-right' ? 'polygon(0 0, 100% 0, 100% 100%)' :
              props.orientation === 'bottom-left' ? 'polygon(0 0, 0 100%, 100% 100%)' :
              props.orientation === 'bottom-right' ? 'polygon(0 100%, 100% 0, 100% 100%)' : '',
    backgroundColor: props.color,
  }
}))`
  position: absolute;
  width: 100%;
  height: 100%;
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

const TriangleHypotenuse = styled.div.attrs<{ $orientation: TriangleOrientation }>(props => ({
  style: {
    clipPath: props.$orientation === 'top-left' ? 'polygon(0 0, 0 100%, 100% 0)' :
             props.$orientation === 'top-right' ? 'polygon(0 0, 100% 0, 100% 100%)' :
             props.$orientation === 'bottom-left' ? 'polygon(0 0, 0 100%, 100% 100%)' :
             props.$orientation === 'bottom-right' ? 'polygon(0 100%, 100% 0, 100% 100%)' : '',
  }
}))`
  position: absolute;
  width: 100%;
  height: 100%;
  border: 1px solid red;
  pointer-events: none;
  z-index: 2;
`;

const HoverOverlay = styled.div.attrs<{ $row: number; $col: number; $triangleMode: TriangleOrientation | null }>(props => ({
  style: {
    top: `${props.$row * (PIXEL_SIZE + 1)}px`,
    left: `${props.$col * (PIXEL_SIZE + 1)}px`,
  }
}))`
  position: absolute;
  width: ${PIXEL_SIZE}px;
  height: ${PIXEL_SIZE}px;
  border: 1px solid red;
  pointer-events: none;
  z-index: 1;
  background-color: ${props => props.$triangleMode ? 'rgba(255, 0, 0, 0.2)' : 'transparent'};
  clip-path: ${props => props.$triangleMode ? 
    (props.$triangleMode === 'top-left' ? 'polygon(0 0, 0 100%, 100% 0)' :
     props.$triangleMode === 'top-right' ? 'polygon(0 0, 100% 0, 100% 100%)' :
     props.$triangleMode === 'bottom-left' ? 'polygon(0 0, 0 100%, 100% 100%)' :
     props.$triangleMode === 'bottom-right' ? 'polygon(0 100%, 100% 0, 100% 100%)' : '') : ''};
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
  const [grid, setGrid] = useState<Grid>(createEmptyGrid());
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    currentColor: 'black',
    triangleMode: null,
  });
  const [lastPosition, setLastPosition] = useState<{ row: number; col: number } | null>(null);
  const [hoveredPixel, setHoveredPixel] = useState<{ row: number; col: number } | null>(null);
  const [temporaryColor, setTemporaryColor] = useState<PixelColor | null>(null);
  const [isCursorHidden, setIsCursorHidden] = useState(false);

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

  const handleMouseDown = (row: number, col: number) => {
    setDrawingState(prev => ({ ...prev, isDrawing: true }));
    setLastPosition({ row, col });
    updatePixel(row, col);
  };

  const handleMouseMove = (row: number, col: number) => {
    if (drawingState.isDrawing && lastPosition) {
      drawLine(lastPosition.col, lastPosition.row, col, row);
      setLastPosition({ row, col });
    }
  };

  const handleMouseUp = () => {
    setDrawingState(prev => ({ ...prev, isDrawing: false }));
    setLastPosition(null);
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

  useEffect(() => {
    if (isCursorHidden) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = 'default';
    }
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [isCursorHidden]);

  const exportAsPNG = useCallback(() => {
    const gridElement = document.getElementById('grid');
    if (gridElement) {
      toPng(gridElement, { 
        width: GRID_SIZE * PIXEL_SIZE,
        height: GRID_SIZE * PIXEL_SIZE,
        style: {
          transform: 'none',
          margin: '0',
          background: 'white'
        }
      })
        .then((dataUrl) => {
          saveAs(dataUrl, 'grid-drawing.png');
        });
    }
  }, []);

  const exportAsSVG = useCallback(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', `${GRID_SIZE * PIXEL_SIZE * 10}`);
    svg.setAttribute('height', `${GRID_SIZE * PIXEL_SIZE * 10}`);
    svg.setAttribute('viewBox', `0 0 ${GRID_SIZE * PIXEL_SIZE} ${GRID_SIZE * PIXEL_SIZE}`);

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
      <GridContainer 
        id="grid" 
        $isDrawing={drawingState.isDrawing}
        onMouseEnter={() => setIsCursorHidden(true)}
        onMouseLeave={() => setIsCursorHidden(false)}
      >
        {grid.map((row, i) =>
          row.map((pixel, j) => (
            <PixelElement
              key={`${i}-${j}`}
              color={pixel.color}
              onMouseDown={() => handleMouseDown(i, j)}
              onMouseMove={() => handleMouseMove(i, j)}
              onMouseUp={handleMouseUp}
              onMouseEnter={() => setHoveredPixel({ row: i, col: j })}
              onMouseLeave={() => setHoveredPixel(null)}
            >
              {pixel.triangle && (
                <Triangle
                  orientation={pixel.triangle.orientation}
                  color={pixel.triangle.color}
                />
              )}
            </PixelElement>
          ))
        )}
        {hoveredPixel && (
          <>
            <HoverOverlay
              $row={hoveredPixel.row}
              $col={hoveredPixel.col}
              $triangleMode={drawingState.triangleMode}
            />
            {drawingState.triangleMode && (
              <TriangleHypotenuse
                $orientation={drawingState.triangleMode}
                style={{
                  top: `${hoveredPixel.row * (PIXEL_SIZE + 1)}px`,
                  left: `${hoveredPixel.col * (PIXEL_SIZE + 1)}px`,
                  width: `${PIXEL_SIZE}px`,
                  height: `${PIXEL_SIZE}px`,
                }}
              />
            )}
          </>
        )}
      </GridContainer>
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