export type PixelState = 'clear' | 'black' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type HoverRegion = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export type Grid = PixelState[][];

export interface DrawingState {
  isDrawing: boolean;
  hoverRegion: HoverRegion | null;
} 