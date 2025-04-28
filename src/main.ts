import { saveAs } from 'file-saver';

type PixelState = 'clear' | 'black' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type HoverRegion = PixelState | 'center';
type DrawingState = {
  isDrawing: boolean;
  hoverRegion: HoverRegion | null;
};

const GRID_SIZE = 26;
const EXPORT_PIXEL_SIZE = 12;

class GridManager {
  private grid: PixelState[][];
  private onChange: (grid: PixelState[][]) => void;

  constructor(initialGrid: PixelState[][], onChange: (grid: PixelState[][]) => void) {
    this.grid = initialGrid;
    this.onChange = onChange;
  }

  updatePixel(row: number, col: number, state: PixelState = 'black') {
    const newGrid = this.grid.map(row => [...row]);
    newGrid[row][col] = state;
    this.grid = newGrid;
    this.onChange(newGrid);
  }

  getGrid(): PixelState[][] {
    return this.grid.map(row => [...row]);
  }

  setGrid(newGrid: PixelState[][]) {
    this.grid = newGrid.map(row => [...row]);
    this.onChange(this.grid);
  }
}

const createEmptyGrid = (): PixelState[][] => {
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

class App {
  private baseCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private canvasContainer: HTMLElement;
  private grid: PixelState[][];
  private gridManager: GridManager;
  private backgroundImage: HTMLImageElement | null = null;
  private pixelSize = 32;
  private canvasSize = GRID_SIZE * this.pixelSize;
  private drawingState: DrawingState = {
    isDrawing: false,
    hoverRegion: null
  };
  private drawingMode: PixelState = 'black';
  private lastPosition: { row: number; col: number; region: HoverRegion } | null = null;
  private previousPosition: { row: number; col: number; region: HoverRegion } | null = null;
  private hoverPosition: { row: number; col: number; region: HoverRegion } | null = null;
  private mousePosition: { x: number; y: number } | null = null;
  private keyboardPosition: { row: number; col: number } | null = null;

  constructor() {
    this.baseCanvas = document.getElementById('base-canvas') as HTMLCanvasElement;
    this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    this.canvasContainer = document.querySelector('.canvas-container') as HTMLElement;
    this.grid = createEmptyGrid();
    this.gridManager = new GridManager(this.grid, (newGrid) => {
      this.grid = newGrid;
      this.drawBase();
    });

    this.initializeEventListeners();
    this.updatePixelSize();
    window.addEventListener('resize', () => this.updatePixelSize());
  }

  private updatePixelSize() {
    const windowHeight = window.innerHeight;
    this.pixelSize = Math.floor((windowHeight - 100) / GRID_SIZE);
    this.canvasSize = GRID_SIZE * this.pixelSize;
    this.canvasContainer.style.width = `${this.canvasSize}px`;
    this.canvasContainer.style.height = `${this.canvasSize}px`;
    
    const dpr = window.devicePixelRatio || 1;
    this.baseCanvas.width = this.canvasSize * dpr;
    this.baseCanvas.height = this.canvasSize * dpr;
    this.overlayCanvas.width = this.canvasSize * dpr;
    this.overlayCanvas.height = this.canvasSize * dpr;
    
    const baseCtx = this.baseCanvas.getContext('2d');
    const overlayCtx = this.overlayCanvas.getContext('2d');
    
    if (baseCtx && overlayCtx) {
      baseCtx.scale(dpr, dpr);
      overlayCtx.scale(dpr, dpr);
    }
    
    this.baseCanvas.style.width = `${this.canvasSize}px`;
    this.baseCanvas.style.height = `${this.canvasSize}px`;
    this.overlayCanvas.style.width = `${this.canvasSize}px`;
    this.overlayCanvas.style.height = `${this.canvasSize}px`;
    
    this.drawBase();
  }

  private drawBase() {
    const ctx = this.baseCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

    if (this.backgroundImage) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.backgroundImage, 0, 0, this.canvasSize, this.canvasSize);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 0.5;

    ctx.beginPath();
    ctx.translate(0.25, 0.25);
    
    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = i * this.pixelSize;
      const y = (GRID_SIZE - i) * this.pixelSize;
      
      if (i > 0 && i < GRID_SIZE) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvasSize);
        ctx.moveTo(0, x);
        ctx.lineTo(this.canvasSize, x);
      }
      
      ctx.moveTo(x, 0);
      ctx.lineTo(this.canvasSize, y);
      
      if (i > 0) {
        ctx.moveTo(0, x);
        ctx.lineTo(y, this.canvasSize);
        ctx.moveTo(y, 0);
        ctx.lineTo(0, y);
        ctx.moveTo(this.canvasSize, y);
        ctx.lineTo(y, this.canvasSize);
      }
    }
    
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = 'black';
    this.grid.forEach((row, i) => {
      row.forEach((pixel, j) => {
        if (pixel === 'clear') return;

        const x = j * this.pixelSize;
        const y = i * this.pixelSize;

        if (pixel === 'black') {
          ctx.fillRect(x, y, this.pixelSize, this.pixelSize);
        } else {
          ctx.beginPath();
          switch (pixel) {
            case 'top-left':
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + this.pixelSize);
              ctx.lineTo(x + this.pixelSize, y);
              break;
            case 'top-right':
              ctx.moveTo(x, y);
              ctx.lineTo(x + this.pixelSize, y);
              ctx.lineTo(x + this.pixelSize, y + this.pixelSize);
              break;
            case 'bottom-left':
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + this.pixelSize);
              ctx.lineTo(x + this.pixelSize, y + this.pixelSize);
              break;
            case 'bottom-right':
              ctx.moveTo(x + this.pixelSize, y);
              ctx.lineTo(x, y + this.pixelSize);
              ctx.lineTo(x + this.pixelSize, y + this.pixelSize);
              break;
          }
          ctx.closePath();
          ctx.fill();
        }
      });
    });
  }

  private drawOverlay() {
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);

    if (this.hoverPosition) {
      const x = this.hoverPosition.col * this.pixelSize;
      const y = this.hoverPosition.row * this.pixelSize;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';

      const region = this.drawingState.isDrawing ? this.drawingMode : this.hoverPosition.region;

      if (region === 'black' || region === 'center' || region === 'clear') {
        ctx.fillRect(x, y, this.pixelSize, this.pixelSize);
      } else {
        ctx.beginPath();
        switch (region) {
          case 'top-left':
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + this.pixelSize);
            ctx.lineTo(x + this.pixelSize, y);
            break;
          case 'top-right':
            ctx.moveTo(x, y);
            ctx.lineTo(x + this.pixelSize, y);
            ctx.lineTo(x + this.pixelSize, y + this.pixelSize);
            break;
          case 'bottom-left':
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + this.pixelSize);
            ctx.lineTo(x + this.pixelSize, y + this.pixelSize);
            break;
          case 'bottom-right':
            ctx.moveTo(x + this.pixelSize, y);
            ctx.lineTo(x, y + this.pixelSize);
            ctx.lineTo(x + this.pixelSize, y + this.pixelSize);
            break;
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    if (this.mousePosition) {
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(this.mousePosition.x, this.mousePosition.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private getMousePosition(e: MouseEvent) {
    const rect = this.baseCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / this.pixelSize);
    const row = Math.floor(y / this.pixelSize);

    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) {
      return null;
    }

    const cellX = (x % this.pixelSize) / this.pixelSize;
    const cellY = (y % this.pixelSize) / this.pixelSize;

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
  }

  private handleMouseDown = (e: MouseEvent) => {
    const pos = this.getMousePosition(e);
    if (!pos) return;

    this.drawingState.isDrawing = true;
    this.drawingState.hoverRegion = pos.region;
    this.lastPosition = pos;
    this.previousPosition = pos;
    this.hoverPosition = pos;

    const state = pos.region === 'center' ? 'black' : pos.region;
    this.gridManager.updatePixel(pos.row, pos.col, state);
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.baseCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.mousePosition = { x, y };

    const pos = this.getMousePosition(e);
    if (!pos) return;

    if (this.drawingState.isDrawing && this.previousPosition) {
      this.hoverPosition = { ...pos, region: this.lastPosition?.region || pos.region };
      
      const state = this.lastPosition?.region === 'center' ? 'black' : (this.lastPosition?.region || pos.region) as PixelState;

      bresenhamLine(
        this.previousPosition.col,
        this.previousPosition.row,
        pos.col,
        pos.row,
        (x, y) => {
          if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            this.gridManager.updatePixel(y, x, state);
          }
        }
      );
      this.previousPosition = pos;
    } else {
      this.hoverPosition = pos;
    }
    this.drawOverlay();
  };

  private handleMouseUp = () => {
    this.drawingState.isDrawing = false;
    this.lastPosition = null;
    this.previousPosition = null;
  };

  private handleMouseLeave = () => {
    this.hoverPosition = null;
    this.mousePosition = null;
    this.drawOverlay();
  };

  private exportAsPNG = () => {
    const hash = generateHash(this.grid);
    const exportCanvas = document.createElement('canvas');
    const exportSize = GRID_SIZE * 32;
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, exportSize, exportSize);

    this.grid.forEach((row, i) => {
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
  };

  private exportAsSVG = () => {
    const hash = generateHash(this.grid);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const exportSize = GRID_SIZE * EXPORT_PIXEL_SIZE;
    svg.setAttribute('width', `${exportSize}`);
    svg.setAttribute('height', `${exportSize}`);
    svg.setAttribute('viewBox', `0 0 ${exportSize} ${exportSize}`);

    this.grid.forEach((row, i) => {
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
  };

  private exportAsJSON = () => {
    const hash = generateHash(this.grid);
    const exportData = {
      version: 1,
      grid: this.grid
    };
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    saveAs(blob, `${hash}.json`);
  };

  private exportAll = () => {
    this.exportAsPNG();
    this.exportAsSVG();
    this.exportAsJSON();
  };

  private handleFileDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) {
      if (file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const loadedData = JSON.parse(event.target?.result as string);
            const loadedGrid = loadedData.version === 1 ? loadedData.grid : loadedData;
            this.gridManager.setGrid(loadedGrid);
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
            this.backgroundImage = img;
            (document.getElementById('clear-background') as HTMLElement).style.display = 'block';
            this.drawBase();
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  };

  private clearBackground = () => {
    this.backgroundImage = null;
    (document.getElementById('clear-background') as HTMLElement).style.display = 'none';
    this.drawBase();
  };

  private invertPixels = () => {
    const newGrid = this.grid.map(row =>
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
    this.gridManager.setGrid(newGrid);
  };

  private initializeEventListeners() {
    this.baseCanvas.addEventListener('mousedown', this.handleMouseDown);
    this.baseCanvas.addEventListener('mousemove', this.handleMouseMove);
    this.baseCanvas.addEventListener('mouseup', this.handleMouseUp);
    this.baseCanvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.overlayCanvas.addEventListener('mousedown', this.handleMouseDown);
    this.overlayCanvas.addEventListener('mousemove', this.handleMouseMove);
    this.overlayCanvas.addEventListener('mouseup', this.handleMouseUp);
    this.overlayCanvas.addEventListener('mouseleave', this.handleMouseLeave);

    document.addEventListener('keydown', (e) => {
      if (!this.hoverPosition) return;
      
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
        this.drawingState.isDrawing = true;
        this.drawingMode = mode;
        this.keyboardPosition = { row: this.hoverPosition.row, col: this.hoverPosition.col };
        this.gridManager.updatePixel(this.hoverPosition.row, this.hoverPosition.col, mode);
      }
    });

    document.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (['z', 'x', 'q', 'w', 'a', 's'].includes(key)) {
        this.drawingState.isDrawing = false;
        this.keyboardPosition = null;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.drawingState.isDrawing && this.keyboardPosition && this.hoverPosition) {
        bresenhamLine(
          this.keyboardPosition.col,
          this.keyboardPosition.row,
          this.hoverPosition.col,
          this.hoverPosition.row,
          (x, y) => {
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
              this.gridManager.updatePixel(y, x, this.drawingMode);
            }
          }
        );
        this.keyboardPosition = { row: this.hoverPosition.row, col: this.hoverPosition.col };
      }
    });

    document.getElementById('export-png')?.addEventListener('click', this.exportAsPNG);
    document.getElementById('export-svg')?.addEventListener('click', this.exportAsSVG);
    document.getElementById('export-json')?.addEventListener('click', this.exportAsJSON);
    document.getElementById('export-all')?.addEventListener('click', this.exportAll);
    document.getElementById('clear-background')?.addEventListener('click', this.clearBackground);
    document.getElementById('invert-colors')?.addEventListener('click', this.invertPixels);

    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', this.handleFileDrop);
  }
}

// Initialize the app
new App(); 