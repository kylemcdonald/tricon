export type PixelColor = 'black' | 'clear';

export type TriangleOrientation = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type HoverRegion = TriangleOrientation | 'center';

export interface Pixel {
  color: PixelColor;
  triangle?: {
    orientation: TriangleOrientation;
  };
}

export type Grid = Pixel[][];

export interface DrawingState {
  isDrawing: boolean;
  triangleMode: TriangleOrientation | null;
  hoverRegion: HoverRegion | null;
} 