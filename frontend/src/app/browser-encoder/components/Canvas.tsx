import { Card, CardContent } from '@/components/ui/card';
import { ResizeInfo } from '../types';

interface CanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  resolution: '720p' | '1080p';
  resizeInfo: ResizeInfo | null;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  updateCursor: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  canvasRef,
  overlayCanvasRef,
  resolution,
  resizeInfo,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  updateCursor,
}) => {
  const getCanvasSize = (res: '720p' | '1080p') => {
    return res === '720p' ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
  };

  return (
    <Card className='flex items-center'>
      <CardContent className="p-4 w-full">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            width={getCanvasSize(resolution).width}
            height={getCanvasSize(resolution).height}
            className="absolute top-0 left-0 w-full h-full"
          />
          <canvas
            ref={overlayCanvasRef}
            width={getCanvasSize(resolution).width}
            height={getCanvasSize(resolution).height}
            className="absolute top-0 left-0 w-full h-full cursor-move"
            onMouseDown={onMouseDown}
            onMouseMove={(e) => {
              onMouseMove(e);
              updateCursor(e);
            }}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          />
        </div>
      </CardContent>
    </Card>
  );
};
