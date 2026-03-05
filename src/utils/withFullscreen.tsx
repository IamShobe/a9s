import React, { forwardRef, useEffect, useState } from 'react';
import { Box, render } from 'ink';
import type { DOMElement } from 'ink';
import type { BoxProps } from 'ink';
import type { Instance } from 'ink';

interface ScreenSize {
  columns: number;
  rows: number;
}

// Hook replacing useTerminalSize — listens for resize events
export function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>({
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  });

  useEffect(() => {
    const handler = () =>
      setSize({
        columns: process.stdout.columns ?? 80,
        rows: process.stdout.rows ?? 24,
      });
    process.stdout.on('resize', handler);
    return () => {
      process.stdout.off('resize', handler);
    };
  }, []);

  return size;
}

interface FullscreenBoxProps extends BoxProps {
  children?: React.ReactNode;
}

// Full-terminal Box — takes exactly columns×rows
export const FullscreenBox = forwardRef<DOMElement, FullscreenBoxProps>(
  ({ children, ...props }, ref) => {
    const { columns, rows } = useScreenSize();
    return (
      <Box ref={ref} width={columns} height={rows} {...props}>
        {children}
      </Box>
    );
  }
);
FullscreenBox.displayName = 'FullscreenBox';

interface WithFullscreenResult {
  instance: Instance;
  cleanup: () => void;
}

// Wrap render() with alternate screen buffer enter/exit
export function withFullscreen(
  element: React.ReactElement
): WithFullscreenResult {
  process.stdout.write('\x1b[?1049h'); // enter alternate screen
  process.stdout.write('\x1b[H'); // move cursor to top-left

  const instance = render(element);

  const cleanup = () => {
    instance.unmount();
    process.stdout.write('\x1b[?1049l'); // exit alternate screen
  };

  return { instance, cleanup };
}
