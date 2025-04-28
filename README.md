# Grid Drawing Tool

A React-based drawing tool that allows users to create pixel art and geometric patterns on a grid. The tool supports both square pixels and triangular subdivisions, making it perfect for creating pixel art, isometric designs, and geometric patterns.

## Features

- 26x26 grid with adjustable pixel size
- Two drawing modes:
  - Square pixels (black or clear)
  - Triangular subdivisions (black triangles in one of four corners)
- Export capabilities:
  - PNG export
  - SVG export
  - JSON export (for saving and loading drawings)
- Drag and drop support for loading saved drawings
- Keyboard shortcuts for quick access to features

## Keyboard Controls

- `Z`: Draw black pixel
- `X`: Clear pixel (erase)
- `Q`: Draw black triangle in bottom-right corner
- `W`: Draw black triangle in bottom-left corner
- `A`: Draw black triangle in top-right corner
- `S`: Draw black triangle in top-left corner

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/grid-drawing-tool.git
cd grid-drawing-tool
```

2. Install dependencies:
```bash
npm install
```

## Development

To start the development server:
```bash
npm start
```

This will run the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Building for Production

To create a production build:
```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

## Serving the Production Build

You can serve the production build using any static file server. For example, using `serve`:

1. Install serve globally:
```bash
npm install -g serve
```

2. Serve the build directory:
```bash
serve -s build
```

## How It Works

The grid drawing tool is built using React and styled-components. The main components are:

1. **Grid Container**: A styled div that creates the grid layout using CSS Grid
2. **Pixel Elements**: Individual cells that can be either black squares, clear squares, or contain black triangles in one of four corners
3. **Drawing State**: Manages the current drawing mode and triangle orientation
4. **Export Functions**: Convert the grid state to various formats (PNG, SVG, JSON)

The tool uses Bresenham's line algorithm for smooth line drawing when dragging the mouse across multiple pixels. The drawing state is managed using React's useState hook, and the grid is represented as a 2D array of pixel objects.

## License

This project is open source and available under the MIT License.
