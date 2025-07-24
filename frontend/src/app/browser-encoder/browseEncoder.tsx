'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from "next/navigation";
import { Session } from 'next-auth';
import { Card } from '@/components/ui/card';
import Chat from '@/components/chat';
import { useAudioMixer } from './hooks/useAudioMixer';
import { useVideoSources } from './hooks/useVideoSources';
import { useCanvas } from './hooks/useCanvas';
import { useStreamControl } from './hooks/useStreamControl';
import { StreamControls } from './components/StreamControls';
import { SourceList } from './components/SourceList';
import { AudioMixer } from './components/AudioMixer';
import { Canvas } from './components/Canvas';

export default function BrowserEncoder({
  streamTitle,
  id,
  session
}: {
  streamTitle: string | null;
  id: number;
  session: Session | null;
}) {
  const searchParams = useSearchParams();
  const [streamKey, setStreamKey] = useState(searchParams.get('stream_key') || '');
  const [streamAccessKey, setStreamAccessKey] = useState('');
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
  }>({ audioInputs: [], videoInputs: [] });
  const [editingName, setEditingName] = useState<string | null>(null);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [screenShareSettings, setScreenShareSettings] = useState({
    maintainAspectRatio: true,
    resolution: '720p' as '720p' | '1080p'
  });
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
  
  // Debug information state
  const [debugInfo, setDebugInfo] = useState({
    fps: 0,
    connectionStatus: 'disconnected',
    bitrate: 0,
    droppedFrames: 0,
    encodingTime: 0
  });
  const fpsCounterRef = useRef({ frames: 0, lastTime: 0 });
  const bitrateRef = useRef({ bytes: 0, lastTime: 0, value: 0 });
  const connectionStatusRef = useRef<string>('disconnected');
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const droppedFramesRef = useRef(0);
  const encodingTimeRef = useRef(0);

  const {
    videoSources,
    selectedSourceId,
    setSelectedSourceId,
    isScreenSharing,
    videoSourcesRef,
    setVideoSources,
    addVideoSource,
    removeSource,
    moveSourceLayer,
    toggleVideoLoop,
    toggleCropping,
    renameSource: renameVideoSource
  } = useVideoSources();

  const {
    audioSources,
    initAudioMixer,
    addAudioSource,
    updateAudioVolume,
    toggleMute,
    toggleLoop,
    playAudio,
    pauseAudio,
    removeAudioSource,
    audioContextRef,
    mainGainNodeRef
  } = useAudioMixer();

  // Safely get stream access key from localStorage on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accessKey = localStorage.getItem('stream_access_key') ?? '';
      setStreamAccessKey(accessKey);
    }
  }, []);

  const {
    isStreaming,
    startStreaming,
    stopStreaming,
    wsConnectionRef,
    activeRecorderRef
  } = useStreamControl({
    streamKey,
    ch_pass: streamAccessKey,
    videoSourcesRef,
    mainGainNodeRef
  });

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

  const {
    canvasRef,
    overlayCanvasRef,
    drawCanvas,
    drawOverlay,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    updateCursor
  } = useCanvas(
    videoSourcesRef,
    setSelectedSourceId,
    selectedSourceId,
    setResizeInfo,
    drawOverlayCanvas
  );

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

  const handleResolutionChange = (newResolution: '720p' | '1080p') => {
    setResolution(newResolution);
    const { width, height } = newResolution === '720p' 
      ? { width: 1280, height: 720 } 
      : { width: 1920, height: 1080 };
    
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = width;
      overlayCanvasRef.current.height = height;
    }
    
    if (isStreaming) {
      stopStreaming();
      if (audioContextRef.current) {
        startStreaming(audioContextRef.current);
      }
    }
  };

  const handleAddAudioSource = async (deviceId: string) => {
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

  const handleRemoveSource = (sourceId: string) => {
    // Remove audio source first if it exists (exact match or direct relation)
    if (sourceId.startsWith('audio-') || sourceId.startsWith('mic-')) {
      removeAudioSource(sourceId);
    }
    
    // For video sources (including screen share), let the video source removal 
    // handle the audio cleanup through the custom event system
    // This prevents duplicate audio removal logic
    
    // Remove the video source (this will trigger the custom event)
    removeSource(sourceId);
  };

  const handleRenameSource = (sourceId: string, newName: string) => {
    if (sourceId.startsWith('audio-') || sourceId.startsWith('mic-') || sourceId.startsWith('screen-')) {
      // オーディオソースの名前を更新
      const source = audioSources[sourceId];
      if (source) {
        addAudioSource(sourceId, null, {
          ...source,
          name: newName
        });
      }
    } else {
      renameVideoSource(sourceId, newName);
    }
  };

  // Update debug information
  const updateDebugInfo = () => {
    // Update FPS counter
    const now = performance.now();
    fpsCounterRef.current.frames++;
    
    if (now - fpsCounterRef.current.lastTime >= 1000) {
      const fps = Math.round(fpsCounterRef.current.frames * 1000 / (now - fpsCounterRef.current.lastTime));
      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastTime = now;
      
      // Update connection status
      let connectionStatus = 'disconnected';
      if (isStreaming) {
        if (wsConnectionRef.current?.readyState === WebSocket.OPEN) {
          connectionStatus = 'connected';
          
          // Clear any existing error timer if we're now connected
          if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
            errorTimerRef.current = null;
          }
        } else if (wsConnectionRef.current?.readyState === WebSocket.CONNECTING) {
          connectionStatus = 'connecting';
        } else {
          connectionStatus = 'error 再接続中...';
          
          // If status changed to error, set a timer to check if it persists
          if (connectionStatusRef.current !== 'error') {
            console.log('Connection status changed to error, setting 5s timer for auto-reconnect');
            
            // Clear any existing timer
            if (errorTimerRef.current) {
              clearTimeout(errorTimerRef.current);
            }
            
            // Set new timer for auto-reconnect after 5 seconds
            errorTimerRef.current = setTimeout(() => {
              if (debugInfo.connectionStatus === 'error' && isStreaming) {
                console.log('Connection still in error after 5s, attempting to reconnect');
                
                // Stop and restart streaming to reconnect
                stopStreaming();
                if (audioContextRef.current) {
                  setTimeout(() => {
                    startStreaming(audioContextRef.current!);
                  }, 1000); // Wait 1 second before reconnecting
                }
              }
              errorTimerRef.current = null;
            }, 5000);
          }
        }
      }
      
      // Store current status for comparison in next update
      connectionStatusRef.current = connectionStatus;
      
      // Update debug info state
      setDebugInfo({
        fps,
        connectionStatus,
        bitrate: bitrateRef.current.value,
        droppedFrames: droppedFramesRef.current,
        encodingTime: encodingTimeRef.current
      });
    }
    
    if (isStreaming) {
      requestAnimationFrame(updateDebugInfo);
    }
  };

  useEffect(() => {
    drawCanvas();
    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    
    return () => {
      stopStreaming();
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      Object.values(audioContextRef.current || {}).forEach(mixer => {
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
    drawCanvas();
  }, [videoSources]);

  // Start debug info monitoring when streaming starts
  useEffect(() => {
    if (isStreaming) {
      // Reset counters
      fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
      bitrateRef.current = { bytes: 0, lastTime: performance.now(), value: 0 };
      droppedFramesRef.current = 0;
      
      // Start monitoring
      updateDebugInfo();
      
      // Monitor MediaRecorder events if available
      if (activeRecorderRef.current) {
        const recorder = activeRecorderRef.current;
        const originalDataAvailable = recorder.ondataavailable;
        
        recorder.ondataavailable = (event: BlobEvent) => {
          // Call the original handler
          if (originalDataAvailable) {
            originalDataAvailable.call(recorder, event);
          }
          
          // Update bitrate calculation
          const now = performance.now();
          bitrateRef.current.bytes += event.data.size;
          
          if (now - bitrateRef.current.lastTime >= 1000) {
            const seconds = (now - bitrateRef.current.lastTime) / 1000;
            const bits = bitrateRef.current.bytes * 8;
            bitrateRef.current.value = Math.round(bits / seconds / 1000); // kbps
            bitrateRef.current.bytes = 0;
            bitrateRef.current.lastTime = now;
          }
        };
      }
    }
  }, [isStreaming]);

  // Add beforeunload event listener when streaming is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isStreaming) {
        // Standard way to show a confirmation dialog
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = '配信中です。本当にページを離れますか？';
        return '配信中です。本当にページを離れますか？';
      }
    };

    if (isStreaming) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Clear any error timers when component unmounts
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, [isStreaming]);

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-0 md:grid-cols-[minmax(0,400px)_1fr_350px] flex-1">
        <div className="flex flex-col h-full">
          <StreamControls
            streamTitle={streamTitle}
            isStreaming={isStreaming}
            resolution={resolution}
            onResolutionChange={handleResolutionChange}
            onStartStreaming={() => {
              if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
              }
              
              // Initialize audio mixer if main gain node is not initialized
              if (!mainGainNodeRef.current) {
                initAudioMixer();
              }
              
              startStreaming(audioContextRef.current);
            }}
            onStopStreaming={stopStreaming}
          />
          <SourceList
            videoSources={videoSources}
            audioSources={audioSources}
            devices={devices}
            selectedSourceId={selectedSourceId}
            isScreenSharing={isScreenSharing}
            editingName={editingName}
            screenShareSettings={screenShareSettings}
            onAddVideoSource={async (type, deviceId) => {
              try {
                const result = await addVideoSource(type, deviceId, screenShareSettings);
                
                // Handle screen sharing audio
                if (type === 'screen' && result && result.stream) {
                  const stream = result.stream;
                  const sourceId = result.sourceId;
                  
                  // Check if screen share has audio tracks
                  if (stream.getAudioTracks().length > 0) {
                    // Initialize audio context and mixer if needed
                    if (!audioContextRef.current) {
                      audioContextRef.current = new AudioContext();
                    }
                    
                    if (!mainGainNodeRef.current) {
                      initAudioMixer();
                    }
                    
                    // Add screen share audio to audio mixer
                    addAudioSource(sourceId, stream, {
                      name: 'Screen Audio',
                      type: 'screen'
                    });
                  }
                }
              } catch (error) {
                console.error('Error adding video source:', error);
              }
            }}
            onAddAudioSource={handleAddAudioSource}
            onAddImageSource={async () => {
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

                const stream = (canvas as any).captureStream();
                const video = document.createElement('video');
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true;
                video.srcObject = stream;
                
                await new Promise((resolve) => {
                  video.onloadedmetadata = () => {
                    video.play().then(resolve);
                  };
                });
                const sourceId = `image-${Date.now()}`;

                const newSource = {
                  id: sourceId,
                  name: file.name,
                  stream,
                  videoElement: video,
                  x: Math.random() * 100,
                  y: Math.random() * 100,
                  width: 480,
                  height: (480 * img.height) / img.width,
                  originalDimensions: {
                    width: img.width,
                    height: img.height
                  },
                  originalAspectRatio: img.width / img.height,
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
            }}
            onAddAudioFileSource={async () => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'audio/*';

              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;

                const sourceId = `audio-${Date.now()}`;
                const audioElement = new Audio(URL.createObjectURL(file));
                audioElement.volume = 1.0;

                if (!audioContextRef.current) {
                  audioContextRef.current = new AudioContext();
                }

                const source = audioContextRef.current.createMediaElementSource(audioElement);
                const gainNode = audioContextRef.current.createGain();
                source.connect(gainNode);
                
                if (!mainGainNodeRef.current) {
                  const { mainGain } = initAudioMixer();
                  mainGainNodeRef.current = mainGain;
                }
                
                gainNode.connect(mainGainNodeRef.current);
                
                addAudioSource(sourceId, null, {
                  name: file.name,
                  type: 'audio'
                });
              };

              input.click();
            }}
            onAddVideoFile={async () => {
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
                video.muted = false;
                video.playsInline = true;

                await new Promise((resolve) => {
                  video.onloadeddata = () => resolve(null);
                });

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
                addAudioSource(sourceId, null, {
                  name: file.name,
                  type: 'audio'
                });

                const stream = (video as any).captureStream();
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
            }}
            onRemoveSource={handleRemoveSource}
            onMoveSourceLayer={moveSourceLayer}
            onToggleVideoLoop={toggleVideoLoop}
            onToggleCropping={toggleCropping}
            onRenameSource={handleRenameSource}
            onEditingNameChange={setEditingName}
            onScreenShareSettingsChange={(settings) => 
              setScreenShareSettings(prev => ({ ...prev, ...settings }))
            }
          />
          <AudioMixer
            audioSources={audioSources}
            onUpdateVolume={updateAudioVolume}
            onToggleMute={toggleMute}
            onToggleLoop={toggleLoop}
            onPlayAudio={playAudio}
            onPauseAudio={pauseAudio}
          />
        </div>
        <Canvas
          canvasRef={canvasRef}
          overlayCanvasRef={overlayCanvasRef}
          resolution={resolution}
          resizeInfo={resizeInfo}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={(e) => handleCanvasMouseMove(e, resizeInfo)}
          onMouseUp={() => setResizeInfo(null)}
          onMouseLeave={() => setResizeInfo(null)}
          updateCursor={updateCursor}
        />
        <Chat session={session} id={id} />
      </div>
      <Card className='p-1'>
        <div className='flex px-2 items-center'>
          <div className='flex space-x-4'>
            <div className={`flex items-center ${isStreaming ? 'text-green-500' : 'text-gray-500'}`}>
              <span className='font-medium'>Status:</span>
              <span className='ml-1'>{isStreaming ? debugInfo.connectionStatus : 'offline'}</span>
            </div>
            {isStreaming && (
              <>
                <div className='flex items-center text-blue-500'>
                  <span className='font-medium'>FPS:</span>
                  <span className='ml-1'>{debugInfo.fps}</span>
                </div>
                <div className='flex items-center text-purple-500'>
                  <span className='font-medium'>Bitrate:</span>
                  <span className='ml-1'>{debugInfo.bitrate} kbps</span>
                </div>
              </>
            )}
          </div>
          <p className='ml-auto text-sm'>StreamKey: {streamKey}</p>
        </div>
      </Card>  
    </div>
  );
}
