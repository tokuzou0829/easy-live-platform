'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Plus, Video, Mic, Monitor, Image as ImageIcon, Music, Scissors } from "lucide-react"; // Lucideアイコンを使用
import { useSearchParams } from "next/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // 追加
import { Label } from "@/components/ui/label"; // 追加
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface VideoSource {
  id: string;
  stream: MediaStream;
  videoElement: HTMLVideoElement;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;  // 名前を追加
  loop?: boolean;  // ループ再生フラグを追加
  isAnimated?: boolean;  // アニメーション有無フラグ
  isEditing?: boolean; // 編集状態を追加
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

interface AudioSource {
  gain: GainNode;
  volume: number;
  muted: boolean;
  loop?: boolean;  // ループ再生フラグを追加
  audioElement?: HTMLAudioElement;  // 音声ファイル用のエレメント
  name: string;  // 名前を追加
  type: 'mic' | 'audio' | 'screen';  // ソースタイプを追加
  analyser?: AnalyserNode;  // 追加: 音声解析用
  level?: number;  // 追加: 現在の音声レベル
}

interface ScreenShareSettings {
  maintainAspectRatio: boolean;
  resolution: '720p' | '1080p';
}

export default function BrowserEncoder({streamTitle}:{streamTitle: string | null}) {
  const searchParams = useSearchParams();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [streamKey, setStreamKey] = useState(searchParams.get("stream_key") || '');
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
  }>({ audioInputs: [], videoInputs: [] });
  const [audioSources, setAudioSources] = useState<{[key: string]: { volume: number, muted: boolean, loop?: boolean, name: string, type: 'mic' | 'audio' | 'screen', level?: number }}>({});
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isCanvasActive, setIsCanvasActive] = useState(true);
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p'); // 解像度の状態を追加
  const [screenShareSettings, setScreenShareSettings] = useState<ScreenShareSettings>({
    maintainAspectRatio: true,
    resolution: '720p'
  });

  const currentStreamRef = useRef<MediaStream | null>(null);
  const wsConnectionRef = useRef<WebSocket | null>(null);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const hlsPlayerRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoSourcesRef = useRef<VideoSource[]>([]);
  const dragSourceRef = useRef<{id: string, startX: number, startY: number} | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMixerRef = useRef<{[key: string]: { gain: GainNode, volume: number, muted: boolean, loop?: boolean, audioElement?: HTMLAudioElement, analyser?: AnalyserNode }}>({});
  const mainGainNodeRef = useRef<GainNode | null>(null);
  const [resizeInfo, setResizeInfo] = useState<{
    sourceId: string;
    type: 'move' | 'resize' | 'crop';
    edge?: 'left' | 'right' | 'top' | 'bottom' | 'corner';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    originalX?: number;
    originalY?: number;
  } | null>(null);

  // 追加: 最後の描画時刻を保持するref
  const lastDrawTimeRef = useRef<number>(0);

  const createMediaRecorder = (stream: MediaStream) => {
    let mimeType = 'video/webm;codecs=h264,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      console.warn('H264 not supported, falling back to VP8');
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.error('VP8 also not supported');
        return null;
      }
    }

    const options = {
      mimeType,
      videoBitsPerSecond: 4000000,
      audioBitsPerSecond: 96000,
    };
    
    const recorder = new MediaRecorder(stream, options);
    
    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && wsConnectionRef.current?.readyState === WebSocket.OPEN) {
        try {
          await wsConnectionRef.current.send(event.data);
        } catch (error) {
          console.error('Error sending media chunk:', error);
        }
      }
    };

    recorder.onerror = (event) => {
      //console.error('MediaRecorder Error:', event.error);
      if (activeRecorderRef.current === recorder) {
        stopStreaming();
        alert('Recording error occurred. Stream stopped.');
      }
    };
    
    return recorder;
  };

  const initAudioMixer = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const destination = audioContextRef.current.createMediaStreamDestination();
    if (!mainGainNodeRef.current) {
      mainGainNodeRef.current = audioContextRef.current.createGain();
    }

    // 無音オシレータを作成
    const silentOscillator = audioContextRef.current.createOscillator();
    const silentGain = audioContextRef.current.createGain();
    silentGain.gain.value = 0; // 完全な無音
    silentOscillator.connect(silentGain);
    silentGain.connect(mainGainNodeRef.current);
    silentOscillator.start();

    mainGainNodeRef.current.connect(destination);
    return { destination, mainGain: mainGainNodeRef.current };
  };

  // addAudioSource 関数を修正
const addAudioSource = (sourceId: string, stream: MediaStream | null, options: { name: string, type: 'mic' | 'audio' | 'screen' }) => {
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContext();
  }

  if (stream && stream.getAudioTracks().length === 0) return;

  const gainNode = audioContextRef.current.createGain();
  const analyser = audioContextRef.current.createAnalyser();
  analyser.fftSize = 1024; // より詳細な解析のために増やす
  analyser.smoothingTimeConstant = 0.8; // スムージングを追加
  
  if (stream) {
    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(gainNode);
  }
  
  gainNode.connect(analyser);
  gainNode.gain.value = 1.0; // 初期音量を設定
  
  if (!mainGainNodeRef.current) {
    const { mainGain } = initAudioMixer();
    mainGainNodeRef.current = mainGain;
  }
  
  gainNode.connect(mainGainNodeRef.current);

  audioMixerRef.current[sourceId] = {
    gain: gainNode,
    volume: 1.0,
    muted: false,
    analyser
  };

  setAudioSources(prev => ({
    ...prev,
    [sourceId]: { 
      volume: 1.0, 
      muted: false,
      name: options.name,
      type: options.type,
      level: 0
    }
  }));

  startLevelMeter(sourceId, analyser);
};

// 音声レベル測定用の関数を修正
const startLevelMeter = (sourceId: string, analyser: AnalyserNode) => {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  const updateLevel = () => {
    if (!audioMixerRef.current[sourceId]) return;

    analyser.getByteFrequencyData(dataArray);
    
    // より正確なレベル計算
    let sum = 0;
    const numFrequencies = dataArray.length;
    
    for (let i = 0; i < numFrequencies; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / numFrequencies;
    const normalizedLevel = Math.min(average / 128, 1.0); // 0-1の範囲に正規化

    setAudioSources(prev => ({
      ...prev,
      [sourceId]: {
        ...prev[sourceId],
        level: normalizedLevel
      }
    }));

    requestAnimationFrame(updateLevel);
  };

  updateLevel();
};

  const updateAudioVolume = (sourceId: string, volume: number) => {
    const mixer = audioMixerRef.current[sourceId];
    if (mixer) {
      mixer.volume = volume;
      if (!mixer.muted) {
        mixer.gain.gain.setValueAtTime(volume, audioContextRef.current!.currentTime);
      }
      
      // 状態を更新して再レンダリングをトリガー
      setAudioSources(prev => ({
        ...prev,
        [sourceId]: { 
          ...prev[sourceId],
          volume
        }
      }));
    }
  };

  const toggleMute = (sourceId: string) => {
    const mixer = audioMixerRef.current[sourceId];
    if (mixer) {
      const newMuted = !audioSources[sourceId].muted;
      mixer.gain.gain.value = newMuted ? 0 : audioSources[sourceId].volume;
      
      setAudioSources(prev => ({
        ...prev,
        [sourceId]: { 
          ...prev[sourceId],
          muted: newMuted
        }
      }));
    }
  };

  const drawCanvas = () => {
    const now = performance.now();
    // 33ms未満の場合はスキップして30FPSに調整
    if(now - lastDrawTimeRef.current < 33) {
      requestAnimationFrame(drawCanvas);
      return;
    }
    lastDrawTimeRef.current = now;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });  // アルファチャンネルを無効化
    if (!canvas || !ctx) return;

    // 描画の最適化
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';  // 画質とパフォーマンスのバランス

    // クリアの最適化
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 重ね順を考慮して描画
    const sourcesToDraw = [...videoSourcesRef.current].reverse();
  
    // バッチ処理による描画の最適化
    sourcesToDraw.forEach(source => {
      if (source.videoElement.readyState === 4) {
        try {
          if (source.crop) {
            ctx.drawImage(
              source.videoElement,
              source.crop.x,
              source.crop.y,
              source.crop.width,
              source.crop.height,
              source.x,
              source.y,
              source.width,
              source.height
            );
          } else {
            ctx.drawImage(source.videoElement, source.x, source.y, source.width, source.height);
          }
        } catch (error) {
          console.error('Error drawing video:', error);
        }
      }
    });

    // フレームレートの最適化
    if (isCanvasActive) {
      requestAnimationFrame(drawCanvas);
    }
  };

  const drawOverlay = (overlayCtx: CanvasRenderingContext2D, source: VideoSource) => {
    if (source.id === selectedSourceId) {
      const handleSize = 10;

      // クロップモード時の背景をオーバーレイ
      if (source.isCropping) {
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        overlayCtx.fillRect(0, 0, overlayCanvasRef.current!.width, overlayCanvasRef.current!.height);
        
        // クロップ領域は透明に
        overlayCtx.clearRect(source.x, source.y, source.width, source.height);
      }
  
      // 選択枠の描画
      overlayCtx.strokeStyle = source.isCropping ? '#ffffff' : '#00ff00';
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(source.x, source.y, source.width, source.height);
  
      if (source.isCropping) {
        // クロップガイドラインの描画
        overlayCtx.setLineDash([5, 5]);
        overlayCtx.beginPath();
        // 縦線
        overlayCtx.moveTo(source.x + source.width / 3, source.y);
        overlayCtx.lineTo(source.x + source.width / 3, source.y + source.height);
        overlayCtx.moveTo(source.x + (source.width * 2) / 3, source.y);
        overlayCtx.lineTo(source.x + (source.width * 2) / 3, source.y + source.height);
        // 横線
        overlayCtx.moveTo(source.x, source.y + source.height / 3);
        overlayCtx.lineTo(source.x + source.width, source.y + source.height / 3);
        overlayCtx.moveTo(source.x, source.y + (source.height * 2) / 3);
        overlayCtx.lineTo(source.x + source.width, source.y + (source.height * 2) / 3);
        overlayCtx.stroke();
        overlayCtx.setLineDash([]);
  
        // ハンドルの描画
        const corners = [
          { x: source.x, y: source.y }, // 左上
          { x: source.x + source.width, y: source.y }, // 右上
          { x: source.x, y: source.y + source.height }, // 左下
          { x: source.x + source.width, y: source.y + source.height } // 右下
        ];
  
        overlayCtx.fillStyle = 'white';
        corners.forEach(corner => {
          overlayCtx.fillRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
          overlayCtx.strokeRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
        });
      }
  
      // 通常のリサイズハンドル（右下）
      overlayCtx.fillRect(
        source.x + source.width - 15,
        source.y + source.height - 15,
        15,
        15
      );
    }
  };

  const createVideoElement = async (stream: MediaStream, type: 'camera' | 'screen' | 'image' | 'video'): Promise<HTMLVideoElement> => {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;
    
    // ビデオの再生準備が整うまで待機
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve);
      };
    });

    // オリジナルのアスペクト比を保存
    let aspectRatio = video.videoWidth / video.videoHeight;
    
    if (type === 'camera' || type === 'screen') {
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      if (settings.width && settings.height) {
        aspectRatio = settings.width / settings.height;
      }
    }
    
    return video;
  };

  const startCamera = async () => {
    try {
      // 配信開始時にミキサーを初期化
      const { destination } = initAudioMixer();
      const canvasStream = canvasRef.current!.captureStream(30);

      // キャンバスのビデオストリームとミキサーの音声出力を結合
      return new MediaStream([
        canvasStream.getVideoTracks()[0],
        destination.stream.getAudioTracks()[0]
      ]);
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  };

  const addAudioOnlySource = async (deviceId: string) => {
    const sourceId = `mic-${deviceId}`;
    if (audioSources[sourceId]) {
      alert('このマイクは既に追加されています。');
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      addAudioSource(sourceId, audioStream, {
        name: `Microphone ${deviceId}`,
        type: 'mic'
      });
    } catch (err) {
      console.error('Error adding microphone:', err);
      alert('Failed to add microphone');
    }
  };

  const addVideoSource = async (type: 'camera' | 'screen' | 'image' | 'video', deviceId?: string) => {
    try {
      if (type === 'camera') {
        // カメラの制約を最適化
        const constraints = {
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },  // 1280x720 を理想値に設定
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 }  // フレームレートを制限
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // トラックの設定を最適化
        stream.getVideoTracks().forEach(track => {
          track.contentHint = 'motion';  // モーション最適化
          // エンコーディングの設定
          const settings = track.getSettings();
          if ('applyConstraints' in track) {
            track.applyConstraints({
              width: settings.width,
              height: settings.height,
              frameRate: 30
            });
          }
        });

        const videoElement = await createVideoElement(stream, type);
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
  
        // オリジナルのサイズを保存
        const originalDimensions = {
          width: settings.width || videoElement.videoWidth,
          height: settings.height || videoElement.videoHeight
        };
  
        const sourceId = `camera-${Date.now()}`;
        const aspectRatio = originalDimensions.width / originalDimensions.height;
  
        const newSource: VideoSource = {
          id: sourceId,
          name: sourceId,
          stream,
          videoElement,
          x: Math.random() * 100,
          y: Math.random() * 100,
          width: 480,
          height: 480 / aspectRatio,
          originalDimensions,
          originalAspectRatio: aspectRatio
        };
  
        setVideoSources(prev => [newSource, ...prev]);
        return;
      } else if (type === 'screen') {
        const resolution = screenShareSettings.resolution;
        const displaySize = resolution === '720p' 
          ? { width: 1280, height: 720 } 
          : { width: 1920, height: 1080 };

        const displayMediaOptions = {
          video: {
            width: displaySize.width,
            height: displaySize.height,
            frameRate: { ideal: 30 },
            encodingMode: 'performance'  // パフォーマンス優先
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: {ideal: 2},
            sampleRate: 48000
          }
        };

        const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        
        // スクリーンキャプチャのトラック設定を最適化
        stream.getVideoTracks().forEach(track => {
          track.contentHint = 'detail';  // 画質優先
          // エンコーディング設定の最適化
          if ('applyConstraints' in track) {
            track.applyConstraints({
              width: displaySize.width,
              height: displaySize.height,
              frameRate: 30
            });
          }
        });

        const videoElement = await createVideoElement(stream, type);
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        const uniqueId = Date.now();
        const sourceId = `${type}-${uniqueId}`;

        // オリジナルのサイズを保存
        const originalDimensions = {
          width: settings.width || videoElement.videoWidth,
          height: settings.height || videoElement.videoHeight
        };

        let initialWidth, initialHeight;
        
        if (screenShareSettings.maintainAspectRatio) {
          // アスペクト比維持モード: 元のアスペクト比を保持したまま画面の1/3のサイズに
          const aspectRatio = originalDimensions.width / originalDimensions.height;
          initialWidth = displaySize.width / 3;
          initialHeight = initialWidth / aspectRatio;
        } else {
          // 引き伸ばしモード: 強制的に16:9にする
          initialWidth = displaySize.width / 3;
          initialHeight = (initialWidth * 9) / 16;
        }

        // 画面の中央に配置
        const centerX = (displaySize.width - initialWidth) / 2;
        const centerY = (displaySize.height - initialHeight) / 2;

        const newSource: VideoSource = {
          id: sourceId,
          name: 'Screen Share',
          stream,
          videoElement,
          x: centerX,
          y: centerY,
          width: initialWidth,
          height: initialHeight,
          originalDimensions,
          originalAspectRatio: screenShareSettings.maintainAspectRatio 
            ? originalDimensions.width / originalDimensions.height 
            : 16/9
        };

        // サイズ変更監視
        track.addEventListener('settings', () => {
          const newSettings = track.getSettings();
          if (newSettings.width && newSettings.height) {
            if (screenShareSettings.maintainAspectRatio) {
              // アスペクト比維持モード: 新しいアスペクト比を計算して適用
              const newAspectRatio = newSettings.width / newSettings.height;
              const source = videoSourcesRef.current.find(s => s.id === sourceId);
              if (source) {
                source.height = source.width / newAspectRatio;
                source.originalAspectRatio = newAspectRatio;
                source.originalDimensions = {
                  width: newSettings.width,
                  height: newSettings.height
                };
              }
            }
            // 引き伸ばしモードの場合は何もしない（16:9を維持）
          }
        });

        setVideoSources(prev => [newSource, ...prev]);
        
        if (stream.getAudioTracks().length > 0) {
          addAudioSource(sourceId, stream, {
            name: 'Screen Share Audio',
            type: 'screen'
          });
        }

        stream.getVideoTracks()[0].onended = () => {
          removeSource(sourceId);
          setIsScreenSharing(false);
        };
        
        setIsScreenSharing(true);
        return;
      }

      // ...existing code for other types...

    } catch (err) {
      console.error(`Error adding ${type}:`, err);
      alert(`Failed to add ${type}`);
    }
  };

  // addImageSource 関数を更新
  const addImageSource = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        await new Promise((resolve) => (img.onload = resolve));

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const stream = canvas.captureStream();
        const videoElement = await createVideoElement(stream, 'image');
        const sourceId = `image-${Date.now()}`;

        const newSource = {
          id: sourceId,
          name: file.name,
          stream,
          videoElement,
          x: Math.random() * 100,
          y: Math.random() * 100,
          width: 480,
          height: (480 * img.height) / img.width,
          originalDimensions: {
            width: img.width,
            height: img.height
          },
          originalAspectRatio: img.width / img.height,
          // クロップ情報を追加
          crop: {
            x: 0,
            y: 0,
            width: img.width,
            height: img.height
          }
        };

        setVideoSources(prev => [newSource, ...prev]);
      };

      input.click();
    } catch (err) {
      console.error('Error adding image:', err);
      alert('Failed to add image');
    }
  };

  // addAudioFileSource 関数を追加
  const addAudioFileSource = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const sourceId = `audio-${Date.now()}`;
        const audioElement = new Audio(URL.createObjectURL(file));
        audioElement.volume = 1.0;

        const audioContext = audioContextRef.current || new AudioContext();
        if (!audioContextRef.current) {
          audioContextRef.current = audioContext;
        }

        const source = audioContext.createMediaElementSource(audioElement);
        const gainNode = audioContext.createGain();
        source.connect(gainNode);

        if (!mainGainNodeRef.current) {
          const { mainGain } = initAudioMixer();
          mainGainNodeRef.current = mainGain;
        }

        gainNode.connect(mainGainNodeRef.current);

        audioMixerRef.current[sourceId] = {
          gain: gainNode,
          volume: 1.0,
          muted: false,
          loop: false,
          audioElement
        };

        setAudioSources(prev => ({
          ...prev,
          [sourceId]: { volume: 1.0, muted: false, loop: false, name: file.name, type: 'audio' }
        }));
      };

      input.click();
    } catch (err) {
      console.error('Error adding audio file:', err);
      alert('Failed to add audio file');
    }
  };

  // 動画ファイルを追加する関数
  const addVideoFile = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const videoUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = videoUrl;
        video.autoplay = true;
        video.loop = false;
        video.muted = false; // ミュートを解除
        video.playsInline = true;

        await new Promise((resolve) => {
          video.onloadeddata = () => resolve(null);
        });

        // オーディオコンテキストを使用して音声を処理
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const audioCtx = audioContextRef.current;
        const source = audioCtx.createMediaElementSource(video);
        const gainNode = audioCtx.createGain();
        source.connect(gainNode);

        if (!mainGainNodeRef.current) {
          const { mainGain } = initAudioMixer();
          mainGainNodeRef.current = mainGain;
        }

        gainNode.connect(mainGainNodeRef.current);

        const sourceId = `video-${Date.now()}`;
        const stream = (video as any).captureStream();

        // 音声ミキサーに追加
        audioMixerRef.current[sourceId] = {
          gain: gainNode,
          volume: 1.0,
          muted: false,
          audioElement: video
        };

        setAudioSources(prev => ({
          ...prev,
          [sourceId]: { 
            volume: 1.0, 
            muted: false, 
            loop: false,
            name: file.name,
            type: 'audio'
          }
        }));

        const newSource = {
          id: sourceId,
          name: file.name,
          stream,
          videoElement: video,
          x: Math.random() * 100,
          y: Math.random() * 100,
          width: 480,
          height: 270,
          loop: false,
          originalDimensions: {
            width: video.videoWidth,
            height: video.videoHeight
          },
          originalAspectRatio: video.videoWidth / video.videoHeight,
          // クロップ情報を追加
          crop: {
            x: 0,
            y: 0,
            width: video.videoWidth,
            height: video.videoHeight
          }
        };

        video.play();
        setVideoSources(prev => [newSource, ...prev]);
      };

      input.click();
    } catch (err) {
      console.error('Error adding video:', err);
      alert('Failed to add video');
    }
  };

  // toggleLoop 関数を追加
  const toggleLoop = (sourceId: string) => {
    const mixer = audioMixerRef.current[sourceId];
    if (mixer && mixer.audioElement) {
      const newLoop = !mixer.audioElement.loop;
      mixer.audioElement.loop = newLoop;
      
      setAudioSources(prev => ({
        ...prev,
        [sourceId]: { 
          ...prev[sourceId],
          loop: newLoop
        }
      }));
    }
  };

  // toggleVideoLoop 関数を更新
  const toggleVideoLoop = (sourceId: string) => {
    setVideoSources(prev => 
      prev.map(source => {
        if (source.id === sourceId) {
          const video = source.videoElement;
          const newLoop = !video.loop;
          video.loop = newLoop;

          // 動画が終了している場合は最初から再生
          if (video.ended) {
            video.currentTime = 0;
            video.play();
          }

          return { ...source, loop: newLoop };
        }
        return source;
      })
    );
  };

  // playAudio 関数を追加
  const playAudio = (sourceId: string) => {
    const mixer = audioMixerRef.current[sourceId];
    if (mixer && mixer.audioElement) {
      mixer.audioElement.play();
    }
  };

  // pauseAudio 関数を追加
  const pauseAudio = (sourceId: string) => {
    const mixer = audioMixerRef.current[sourceId];
    if (mixer && mixer.audioElement) {
      mixer.audioElement.pause();
    }
  };

  // removeSource 関数を更新
const removeSource = (sourceId: string) => {
  setVideoSources(prev => {
    const source = prev.find(s => s.id === sourceId);
    if (source) {
      source.stream.getTracks().forEach(track => track.stop());
      source.videoElement.pause();
      source.videoElement.src = '';
      source.videoElement.srcObject = null;
      source.videoElement.remove();
    }
    return prev.filter(s => s.id !== sourceId);
  });

  // 音声ミキサーからの削除
  if (audioMixerRef.current[sourceId]) {
    if (audioMixerRef.current[sourceId].audioElement) {
      audioMixerRef.current[sourceId].audioElement.pause();
      audioMixerRef.current[sourceId].audioElement.src = '';
    }
    audioMixerRef.current[sourceId].gain.disconnect();
    delete audioMixerRef.current[sourceId];
    setAudioSources(prev => {
      const newSources = { ...prev };
      delete newSources[sourceId];
      return newSources;
    });
  }

  // 選択中のソースが削除された場合はクリアする
  if (selectedSourceId === sourceId) {
    setSelectedSourceId(null);
  }

  if (sourceId.startsWith('screen')) {
    setIsScreenSharing(false);
  }

  // オーバーレイの再描画
  drawOverlayCanvas();
};

const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const rect = overlayCanvasRef.current!.getBoundingClientRect();
  const scaleX = overlayCanvasRef.current!.width / rect.width;
  const scaleY = overlayCanvasRef.current!.height / rect.height;
  
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const sources = [...videoSourcesRef.current]
    .sort((a, b) => getSourceIndex(b.id) - getSourceIndex(a.id));

  let found = false;
  for (const source of sources) {
    const handleSize = 10;
    
    // エッジ検出の範囲を定義
    const isNearLeftEdge = Math.abs(x - source.x) <= handleSize;
    const isNearRightEdge = Math.abs(x - (source.x + source.width)) <= handleSize;
    const isNearTopEdge = Math.abs(y - source.y) <= handleSize;
    const isNearBottomEdge = Math.abs(y - (source.y + source.height)) <= handleSize;
    const isWithinVerticalBounds = y >= source.y && y <= source.y + source.height;
    const isWithinHorizontalBounds = x >= source.x && x <= source.x + source.width;

    // 通常のリサイズハンドル（右下）
    const isOnCornerHandle = 
      x >= source.x + source.width - 15 &&
      x <= source.x + source.width &&
      y >= source.y + source.height - 15 &&
      y <= source.y + source.height;

    if (source.id === selectedSourceId) {
      // エッジでのリサイズ
      if (source.isCropping) {
        if (isNearLeftEdge && isWithinVerticalBounds) {
          setResizeInfo({
            sourceId: source.id,
            type: 'crop',
            edge: 'left',
            startX: x,
            startY: y,
            startWidth: source.crop?.width || source.width,
            startHeight: source.crop?.height || source.height,
            originalX: source.crop?.x || 0,
            originalY: source.crop?.y || 0
          });
          found = true;
          break;
        } else if (isNearRightEdge && isWithinVerticalBounds) {
          setResizeInfo({
            sourceId: source.id,
            type: 'crop',
            edge: 'right',
            startX: x,
            startY: y,
            startWidth: source.crop?.width || source.width,
            startHeight: source.crop?.height || source.height,
            originalX: source.crop?.x || 0,
            originalY: source.crop?.y || 0
          });
          found = true;
          break;
        } else if (isNearTopEdge && isWithinHorizontalBounds) {
          setResizeInfo({
            sourceId: source.id,
            type: 'crop',
            edge: 'top',
            startX: x,
            startY: y,
            startWidth: source.crop?.width || source.width,
            startHeight: source.crop?.height || source.height,
            originalX: source.crop?.x || 0,
            originalY: source.crop?.y || 0
          });
          found = true;
          break;
        } else if (isNearBottomEdge && isWithinHorizontalBounds) {
          setResizeInfo({
            sourceId: source.id,
            type: 'crop',
            edge: 'bottom',
            startX: x,
            startY: y,
            startWidth: source.crop?.width || source.width,
            startHeight: source.crop?.height || source.height,
            originalX: source.crop?.x || 0,
            originalY: source.crop?.y || 0
          });
          found = true;
          break;
        }
      }
    }

    // 通常の移動とリサイズの処理
    if (isOnCornerHandle) {
      setResizeInfo({
        sourceId: source.id,
        type: 'resize',
        edge: 'corner',
        startX: x,
        startY: y,
        startWidth: source.width,
        startHeight: source.height
      });
      found = true;
      break;
    }

    if (x >= source.x && x <= source.x + source.width &&
        y >= source.y && y <= source.y + source.height) {
      setSelectedSourceId(source.id);
      setResizeInfo({
        sourceId: source.id,
        type: 'move',
        startX: x - source.x,
        startY: y - source.y,
        startWidth: source.width,
        startHeight: source.height
      });
      found = true;
      break;
    }
  }

  if (!found) {
    setSelectedSourceId(null);
  }
  // オーバーレイ更新を即座に反映
  drawOverlayCanvas();
};

const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
  if (!resizeInfo) return;

  const rect = overlayCanvasRef.current!.getBoundingClientRect();
  const scaleX = overlayCanvasRef.current!.width / rect.width;
  const scaleY = overlayCanvasRef.current!.height / rect.height;
  
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const source = videoSourcesRef.current.find(s => s.id === resizeInfo.sourceId);
  if (!source) return;

  if (resizeInfo.type === 'crop' && source.originalDimensions) {
    // クロップの処理は変更なし
    const maxWidth = source.originalDimensions.width;
    const maxHeight = source.originalDimensions.height;

    // 現在のマウス位置と元の位置との差分を計算
    const deltaX = x - resizeInfo.startX;
    const deltaY = y - resizeInfo.startY;

    let newCrop = { ...source.crop! };

    switch (resizeInfo.edge) {
      case 'left':
        const newLeftX = Math.max(0, Math.min(resizeInfo.originalX! + deltaX, maxWidth));
        newCrop = {
          ...newCrop,
          x: newLeftX,
          width: resizeInfo.startWidth - (newLeftX - source.crop!.x)
        };
        // アスペクト比を維持
        newCrop.height = newCrop.width / source.cropAspectRatio!;
        break;
      case 'right':
        newCrop = {
          ...newCrop,
          width: Math.min(maxWidth - source.crop!.x, Math.max(100, resizeInfo.startWidth + deltaX))
        };
        // アスペクト比を維持
        newCrop.height = newCrop.width / source.cropAspectRatio!;
        break;
      case 'top':
        const newTopY = Math.max(0, Math.min(resizeInfo.originalY! + deltaY, maxHeight));
        newCrop = {
          ...newCrop,
          y: newTopY,
          height: resizeInfo.startHeight - (newTopY - source.crop!.y)
        };
        // アスペクト比を維持
        newCrop.width = newCrop.height * source.cropAspectRatio!;
        break;
      case 'bottom':
        newCrop = {
          ...newCrop,
          height: Math.min(maxHeight - source.crop!.y, Math.max(100, resizeInfo.startHeight + deltaY))
        };
        // アスペクト比を維持
        newCrop.width = newCrop.height * source.cropAspectRatio!;
        break;
    }

    // クロップ範囲が有効かチェック
    if (newCrop.x >= 0 && newCrop.y >= 0 &&
        newCrop.x + newCrop.width <= maxWidth &&
        newCrop.y + newCrop.height <= maxHeight &&
        newCrop.width >= 100 && newCrop.height >= 100) {
      source.crop = newCrop;
    }
  } else if (resizeInfo.type === 'resize') {
    // リサイズ処理を修正
    const newWidth = Math.max(100, resizeInfo.startWidth + (x - resizeInfo.startX));
    if (source.originalAspectRatio) {
      source.width = newWidth;
      source.height = newWidth / source.originalAspectRatio;
    } else {
      source.width = newWidth;
      source.height = Math.max(100, resizeInfo.startHeight + (y - resizeInfo.startY));
    }
  } else if (resizeInfo.type === 'move') {
    // 移動処理を修正（制限を削除）
    source.x = x - resizeInfo.startX;
    source.y = y - resizeInfo.startY;
  }

  requestAnimationFrame(drawCanvas);
  drawOverlayCanvas();
};

// マウスカーソルの見た目を更新する関数を追加
const updateCursor = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const rect = overlayCanvasRef.current!.getBoundingClientRect();
  const scaleX = overlayCanvasRef.current!.width / rect.width;
  const scaleY = overlayCanvasRef.current!.height / rect.height;
  
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const source = videoSourcesRef.current.find(s => s.id === selectedSourceId);
  if (!source) {
    e.currentTarget.style.cursor = 'default';
    return;
  }

  const handleSize = 10;
  const isNearLeftEdge = Math.abs(x - source.x) <= handleSize;
  const isNearRightEdge = Math.abs(x - (source.x + source.width)) <= handleSize;
  const isNearTopEdge = Math.abs(y - source.y) <= handleSize;
  const isNearBottomEdge = Math.abs(y - (source.y + source.height)) <= handleSize;
  const isWithinVerticalBounds = y >= source.y && y <= source.y + source.height;
  const isWithinHorizontalBounds = x >= source.x && x <= source.x + source.width;

  if (source.isCropping) {
    if ((isNearLeftEdge && isWithinVerticalBounds) || (isNearRightEdge && isWithinVerticalBounds)) {
      e.currentTarget.style.cursor = 'ew-resize';
    } else if ((isNearTopEdge && isWithinHorizontalBounds) || (isNearBottomEdge && isWithinHorizontalBounds)) {
      e.currentTarget.style.cursor = 'ns-resize';
    } else {
      e.currentTarget.style.cursor = 'move';
    }
  } else {
    // ... existing cursor logic ...
  }
};

  const handleCanvasMouseUp = () => {
    setResizeInfo(null);
    drawOverlayCanvas();
  };

  const startStreaming = async () => {
    if (!streamKey.trim()) {
      alert('Please enter a stream key');
      return;
    }

    try {
      if (videoSourcesRef.current.length === 0) {
        alert('Please add at least one video source before starting the stream');
        return;
      }

      const stream = await startCamera();
      currentStreamRef.current = stream;
      
      wsConnectionRef.current = new WebSocket(`wss://live-platform-api.tokuzou.me/stream/${streamKey}?password=${localStorage.getItem('stream_access_key')}`);
      
      wsConnectionRef.current.onopen = () => {
        const recorder = createMediaRecorder(stream);
        if (recorder) {
          activeRecorderRef.current = recorder;
          recorder.start(500);
          setIsStreaming(true);
        }
      };

      wsConnectionRef.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
        stopStreaming();
        alert('Connection error occurred');
      };

    } catch (err) {
      console.error('Error starting stream:', err);
      alert('Error starting stream');
    }
  };

  const stopStreaming = () => {
    if (activeRecorderRef.current) {
      activeRecorderRef.current.stop();
      activeRecorderRef.current = null;
    }
    
    if (wsConnectionRef.current) {
      wsConnectionRef.current.close();
      wsConnectionRef.current = null;
    }

    if (currentStreamRef.current) {
      // キャンバスのストリームトラックのみを停止
      const tracks = currentStreamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      currentStreamRef.current = null;
    }

    if (hlsPlayerRef.current) {
      hlsPlayerRef.current.src = '';
    }

    setIsStreaming(false);
  };

  const loadDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioInputs: devices.filter(device => device.kind === 'audioinput'),
        videoInputs: devices.filter(device => device.kind === 'videoinput')
      });
    } catch (err) {
      console.error('Error loading devices:', err);
    }
  };

  // moveSourceLayer 関数を更新
  const moveSourceLayer = (sourceId: string, direction: 'up' | 'down') => {
    setVideoSources(prev => {
      const index = prev.findIndex(s => s.id === sourceId);
      if (index === -1) return prev;
  
      const newSources = [...prev];
      if (direction === 'up' && index > 0) {
        [newSources[index], newSources[index - 1]] = 
        [newSources[index - 1], newSources[index]];
      } else if (direction === 'down' && index < newSources.length - 1) {
        [newSources[index], newSources[index + 1]] = 
        [newSources[index + 1], newSources[index]];
      }
  
      // videoSourcesRef も同時に更新
      videoSourcesRef.current = newSources;
      return newSources;
    });
  };

  const getSourceIndex = (sourceId: string) => {
    const index = videoSourcesRef.current.findIndex(s => s.id === sourceId);
    return videoSourcesRef.current.length - 1 - index; // インデックスを反転
  };

  const renameSource = (sourceId: string, newName: string) => {
    if (sourceId.startsWith('audio-') || sourceId.startsWith('mic-') || sourceId.startsWith('screen-')) {
      setAudioSources(prev => ({
        ...prev,
        [sourceId]: { 
          ...prev[sourceId],
          name: newName
        }
      }));
    } else {
      setVideoSources(prev => 
        prev.map(source => 
          source.id === sourceId 
            ? { ...source, name: newName }
            : source
        )
      );
    }
  };

  // toggleCropping関数を修正して、cropプロパティを確実に初期化
const toggleCropping = (sourceId: string) => {
  setVideoSources(prev => 
    prev.map(source => {
      if (source.id === sourceId) {
        const newCropping = !source.isCropping;
        if (newCropping) {
          // クロップモード開始時
          if (!source.crop) {
            // cropプロパティが未初期化の場合は初期化
            source.crop = {
              x: 0,
              y: 0,
              width: source.originalDimensions?.width || source.videoElement.videoWidth,
              height: source.originalDimensions?.height || source.videoElement.videoHeight
            };
          }
          return {
            ...source,
            isCropping: true,
            cropAspectRatio: source.width / source.height,
            crop: source.crop
          };
        } else {
          // クロップモード終了時
          return {
            ...source,
            isCropping: false
          };
        }
      }
      return source;
    })
  );
};

  // キャンバスサイズを取得する関数
  const getCanvasSize = (res: '720p' | '1080p') => {
    return res === '720p' ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
  };

  // 解像度変更時の処理
  const handleResolutionChange = (newResolution: '720p' | '1080p') => {
    setResolution(newResolution);
    const { width, height } = getCanvasSize(newResolution);
    
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = width;
      overlayCanvasRef.current.height = height;
    }
    
    // ストリーミング中の場合は再起動
    if (isStreaming) {
      stopStreaming();
      startStreaming();
    }
  };

  useEffect(() => {
    drawCanvas();
    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    
    return () => {
      // コンポーネントのアンマウント時のみ完全なクリーンアップを実行
      if (videoSourcesRef.current) {
        videoSourcesRef.current.forEach(source => {
          source.stream.getTracks().forEach(track => track.stop());
          source.videoElement.pause();
          source.videoElement.src = '';
          source.videoElement.srcObject = null;
          source.videoElement.remove();
        });
        videoSourcesRef.current = [];
      }
      stopStreaming();
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      Object.values(audioMixerRef.current).forEach(mixer => {
        if (mixer.audioElement) {
          mixer.audioElement.pause();
          mixer.audioElement.src = '';
        }
      });
    };
  }, []);

  useEffect(() => {
    drawOverlayCanvas();
  }, [selectedSourceId, videoSources]);

  useEffect(() => {
    videoSourcesRef.current = videoSources;
    requestAnimationFrame(drawCanvas); // 強制的に再描画
  }, [videoSources]);

  const drawOverlayCanvas = () => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;
  
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (selectedSourceId) {
      const selectedSource = videoSourcesRef.current.find(s => s.id === selectedSourceId);
      if (selectedSource) {
        drawOverlay(overlayCtx, selectedSource);
      }
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Browser Encoder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <h1 className='flex-1 text-xl'>配信：{streamTitle}</h1>
            <RadioGroup
              defaultValue={resolution}
              onValueChange={(value) => handleResolutionChange(value as '720p' | '1080p')}
              className="flex items-center space-x-4"
              disabled={isStreaming} // RadioGroup全体を無効化
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="720p" 
                  id="720p"
                  disabled={isStreaming} // 個別のアイテムも無効化
                />
                <Label 
                  htmlFor="720p" 
                  className={isStreaming ? "text-muted-foreground" : ""} // 配信中は文字色を薄くする
                >
                  720p
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="1080p" 
                  id="1080p"
                  disabled={isStreaming}
                />
                <Label 
                  htmlFor="1080p"
                  className={isStreaming ? "text-muted-foreground" : ""}
                >
                  1080p
                </Label>
              </div>
            </RadioGroup>
            {!isStreaming ? (
              <Button onClick={startStreaming} disabled={isStreaming}>
                配信開始
              </Button>
            ) : (
              <Button 
                onClick={stopStreaming} 
                disabled={!isStreaming}
                variant="destructive"
              >
                配信停止
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[50%_1fr] gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sources</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Video className="h-4 w-4 mr-2" />
                      <span>カメラを追加</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {devices.videoInputs.map(device => (
                          <DropdownMenuItem 
                            key={device.deviceId}
                            onSelect={() => addVideoSource('camera', device.deviceId)}
                          >
                            {device.label || `Camera ${device.deviceId}`}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Mic className="h-4 w-4 mr-2" />
                      <span>マイクを追加</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {devices.audioInputs.map(device => (
                          <DropdownMenuItem 
                            key={device.deviceId}
                            onSelect={() => addAudioOnlySource(device.deviceId)}
                          >
                            {device.label || `Microphone ${device.deviceId}`}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuItem asChild>
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="flex items-center px-2 py-1.5 text-sm">
                          <Monitor className="h-4 w-4 mr-2" />
                          <span>画面を追加</span>
                        </div>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>画面共有の設定</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">
                              元のアスペクト比を維持
                            </label>
                            <Switch
                              checked={screenShareSettings.maintainAspectRatio}
                              onCheckedChange={(checked: boolean) => 
                              setScreenShareSettings((prev: ScreenShareSettings) => ({
                                ...prev,
                                maintainAspectRatio: checked
                              }))
                              }
                            />
                            </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">解像度</label>
                            <RadioGroup
                              value={screenShareSettings.resolution}
                              onValueChange={(value: '720p' | '1080p') =>
                                setScreenShareSettings(prev => ({
                                  ...prev,
                                  resolution: value
                                }))
                              }
                              className="flex items-center space-x-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="720p" id="screenshare-720p" />
                                <Label htmlFor="screenshare-720p">720p</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="1080p" id="screenshare-1080p" />
                                <Label htmlFor="screenshare-1080p">1080p</Label>
                              </div>
                            </RadioGroup>
                          </div>
                          <DialogClose asChild>
                            <Button 
                              className="w-full" 
                              onClick={() => {
                                addVideoSource('screen');
                              }}
                            >
                              画面共有を開始
                            </Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </DropdownMenuItem>

                  <DropdownMenuItem onSelect={addImageSource}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    <span>画像を追加</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onSelect={addAudioFileSource}>
                    <Music className="h-4 w-4 mr-2" />
                    <span>音声ファイルを追加</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onSelect={addVideoFile}>
                    <Video className="h-4 w-4 mr-2" />
                    <span>動画ファイルを追加</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {/* 映像ソース */}
                {videoSources
                  .map((source, index) => (
                    <div 
                      key={source.id} 
                      className={`flex items-center justify-between p-2 rounded-lg mb-2 ${
                        source.id === selectedSourceId ? 'bg-accent' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {source.id.startsWith('camera-') && <Video className="h-4 w-4" />}
                        {source.id.startsWith('screen-') && <Monitor className="h-4 w-4" />}
                        {source.id.startsWith('image-') && <ImageIcon className="h-4 w-4" />}
                        {source.id.startsWith('video-') && <Video className="h-4 w-4" />}
                        {editingName === source.id ? (
                          <Input
                            className="h-6 w-40"
                            value={source.name}
                            autoFocus
                            onChange={(e) => renameSource(source.id, e.target.value)}
                            onBlur={() => setEditingName(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingName(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-accent/50 px-2 py-1 rounded min-w-[160px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingName(source.id);
                            }}
                          >
                            {source.name}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {(source.id.startsWith('video-') || source.isAnimated) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleVideoLoop(source.id)}
                          >
                            {source.loop ? 'Loop: On' : 'Loop: Off'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleCropping(source.id)}
                        >
                          <Scissors className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveSourceLayer(source.id, 'up')}
                          disabled={index === 0} // インデックスで直接判定
                        >
                          ↑
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveSourceLayer(source.id, 'down')}
                          disabled={index === videoSources.length - 1} // インデックスで直接判定
                        >
                          ↓
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => removeSource(source.id)}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}

                {/* 音声ソース */}
                {Object.entries(audioSources)
                  .filter(([id]) => !id.startsWith('screen-')) // 画面共有の音声は除外
                  .map(([sourceId, source]) => (
                    <div 
                      key={sourceId}
                      className="flex items-center justify-between p-2 rounded-lg mb-2 bg-card"
                    >
                      <div className="flex items-center gap-2">
                        {source.type === 'mic' && <Mic className="h-4 w-4" />}
                        {source.type === 'audio' && <Music className="h-4 w-4" />}
                        {editingName === sourceId ? (
                          <Input
                            className="h-6 w-40"
                            value={source.name}
                            autoFocus
                            onChange={(e) => renameSource(sourceId, e.target.value)}
                            onBlur={() => setEditingName(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingName(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-accent/50 px-2 py-1 rounded min-w-[160px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingName(sourceId);
                            }}
                          >
                            {source.name}
                          </span>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeSource(sourceId)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audio Mixer</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {Object.entries(audioSources).map(([sourceId, { volume, muted, loop, level }]) => (
                  <div key={sourceId} className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {audioSources[sourceId].name}
                      </span>
                      <div className="flex gap-2">
                        {sourceId.startsWith('audio-') && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleLoop(sourceId)}
                            >
                              {loop ? 'Loop: On' : 'Loop: Off'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => playAudio(sourceId)}
                            >
                              ▶
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => pauseAudio(sourceId)}
                            >
                              ⏸
                            </Button>
                          </>
                        )}
                        <Button
                          variant={muted ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => toggleMute(sourceId)}
                        >
                          {muted ? 'Unmute' : 'Mute'}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {/* 音量スライダー */}
                      <div className="relative">
                        <Slider
                          value={[volume]}
                          min={0}
                          max={1}
                          step={0.01}
                          disabled={muted}
                          onValueChange={(values: number[]) => updateAudioVolume(sourceId, values[0])}
                          className="z-10 relative"
                        />
                      </div>
                      
                      {/* レベルメーター */}
                      <div className="h-2 bg-accent rounded-full overflow-hidden">
                        <div className="relative w-full h-full">
                          {/* バックグラウンドメーター（ピークホールド） */}
                          <div 
                            className="absolute inset-0 transition-all duration-0"
                            style={{
                              width: `${(level || 0) * 100}%`,
                              backgroundColor: `hsl(${120 - (level || 0) * 120}, 100%, 50%)`
                            }}
                          />
                          {/* dBスケール表示 */}
                          <div className="absolute inset-0 flex justify-between px-1 text-[8px] text-white/50">
                            <span>-inf</span>
                            <span>-40</span>
                            <span>-20</span>
                            <span>-10</span>
                            <span>0dB</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* 数値表示 */}
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Level: {Math.round((level || 0) * 100)}%</span>
                        <span>Volume: {Math.round(volume * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
      </div>
      <Card>
            <CardContent className="p-4">
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
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={(e) => {
                    handleCanvasMouseMove(e);
                    updateCursor(e);
                  }}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              </div>
            </CardContent>
          </Card>
      
    </div>
  );
}