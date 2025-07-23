export interface VideoSource {
  id: string;
  stream: MediaStream;
  videoElement: HTMLVideoElement;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  loop?: boolean;
  isAnimated?: boolean;
  isEditing?: boolean;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  originalAspectRatio?: number;
  isCropping?: boolean;
  cropStartPoint?: { x: number; y: number };
  cropAspectRatio?: number;
  originalDimensions?: {
    width: number;
    height: number;
  };
}

export interface AudioSource {
  gain: GainNode;
  volume: number;
  muted: boolean;
  loop?: boolean;
  audioElement?: HTMLAudioElement;
  name: string;
  type: 'mic' | 'audio' | 'screen';
  analyser?: AnalyserNode;
  level?: number;
}

export interface ScreenShareSettings {
  maintainAspectRatio: boolean;
  resolution: '720p' | '1080p';
}

export interface ResizeInfo {
  sourceId: string;
  type: 'move' | 'resize' | 'crop';
  edge?: 'left' | 'right' | 'top' | 'bottom' | 'corner';
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  originalX?: number;
  originalY?: number;
}

export interface DeviceList {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
}

export interface AudioSourceState {
  volume: number;
  muted: boolean;
  loop?: boolean;
  name: string;
  type: 'mic' | 'audio' | 'screen';
  level?: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}
