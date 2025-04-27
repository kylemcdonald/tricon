export type PixelColor = 'black' | 'white';

export type TriangleOrientation = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type HoverRegion = TriangleOrientation | 'center';

export interface Pixel {
  color: PixelColor;
  triangle?: {
    orientation: TriangleOrientation;
    color: PixelColor;
  };
}

export type Grid = Pixel[][];

export interface DrawingState {
  isDrawing: boolean;
  triangleMode: TriangleOrientation | null;
  hoverRegion: HoverRegion | null;
} 