import { useState, useRef } from 'react';
import { VideoSource, ScreenShareSettings } from '../types';

export const useVideoSources = () => {
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const videoSourcesRef = useRef<VideoSource[]>([]);

  const createVideoElement = async (stream: MediaStream, type: 'camera' | 'screen' | 'image' | 'video'): Promise<HTMLVideoElement> => {
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

  const addVideoSource = async (type: 'camera' | 'screen', deviceId?: string, screenShareSettings?: ScreenShareSettings) => {
    try {
      if (type === 'camera') {
        const constraints = {
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        stream.getVideoTracks().forEach(track => {
          track.contentHint = 'motion';
          if ('applyConstraints' in track) {
            const settings = track.getSettings();
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
      } else if (type === 'screen' && screenShareSettings) {
        const resolution = screenShareSettings.resolution;
        const displaySize = resolution === '720p' 
          ? { width: 1280, height: 720 } 
          : { width: 1920, height: 1080 };

        const displayMediaOptions = {
          video: {
            width: displaySize.width,
            height: displaySize.height,
            frameRate: { ideal: 30 },
            encodingMode: 'performance'
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
        
        // Handle video tracks
        stream.getVideoTracks().forEach(track => {
          track.contentHint = 'detail';
          if ('applyConstraints' in track) {
            track.applyConstraints({
              width: displaySize.width,
              height: displaySize.height,
              frameRate: 30
            });
          }
        });
        
        // Return both audio and video tracks from screen sharing
        const hasAudio = stream.getAudioTracks().length > 0;
        if (hasAudio) {
          console.log('Screen sharing has audio tracks:', stream.getAudioTracks().length);
        }

        const videoElement = await createVideoElement(stream, type);
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        const uniqueId = Date.now();
        const sourceId = `${type}-${uniqueId}`;

        const originalDimensions = {
          width: settings.width || videoElement.videoWidth,
          height: settings.height || videoElement.videoHeight
        };

        let initialWidth, initialHeight;
        
        if (screenShareSettings.maintainAspectRatio) {
          const aspectRatio = originalDimensions.width / originalDimensions.height;
          initialWidth = displaySize.width / 3;
          initialHeight = initialWidth / aspectRatio;
        } else {
          initialWidth = displaySize.width / 3;
          initialHeight = (initialWidth * 9) / 16;
        }

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

        track.addEventListener('settings', () => {
          const newSettings = track.getSettings();
          if (newSettings.width && newSettings.height) {
            if (screenShareSettings.maintainAspectRatio) {
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
          }
        });

        setVideoSources(prev => [newSource, ...prev]);
        setIsScreenSharing(true);

        stream.getVideoTracks()[0].onended = () => {
          removeSource(sourceId);
          setIsScreenSharing(false);
        };
        
        return { sourceId, stream };
      }
    } catch (err) {
      console.error(`Error adding ${type}:`, err);
      throw err;
    }
  };

  const removeSource = (sourceId: string) => {
    setVideoSources(prev => {
      const source = prev.find(s => s.id === sourceId);
      if (source) {
        // Stop all tracks in the stream
        source.stream.getTracks().forEach(track => track.stop());
        
        // Clean up video element
        source.videoElement.pause();
        source.videoElement.src = '';
        source.videoElement.srcObject = null;
        source.videoElement.remove();
        
        // Dispatch a custom event to notify that this source has been removed
        // This will be used by the audio mixer to clean up related audio sources
        const event = new CustomEvent('videoSourceRemoved', { 
          detail: { sourceId } 
        });
        document.dispatchEvent(event);
      }
      return prev.filter(s => s.id !== sourceId);
    });

    if (selectedSourceId === sourceId) {
      setSelectedSourceId(null);
    }

    if (sourceId.startsWith('screen')) {
      setIsScreenSharing(false);
    }
  };

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
  
      videoSourcesRef.current = newSources;
      return newSources;
    });
  };

  const toggleVideoLoop = (sourceId: string) => {
    setVideoSources(prev => 
      prev.map(source => {
        if (source.id === sourceId) {
          const video = source.videoElement;
          const newLoop = !video.loop;
          video.loop = newLoop;

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

  const toggleCropping = (sourceId: string) => {
    setVideoSources(prev => 
      prev.map(source => {
        if (source.id === sourceId) {
          const newCropping = !source.isCropping;
          if (newCropping) {
            if (!source.crop) {
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

  const renameSource = (sourceId: string, newName: string) => {
    setVideoSources(prev => 
      prev.map(source => 
        source.id === sourceId 
          ? { ...source, name: newName }
          : source
      )
    );
  };

  return {
    videoSources,
    selectedSourceId,
    setVideoSources,
    setSelectedSourceId,
    isScreenSharing,
    setIsScreenSharing,
    videoSourcesRef,
    addVideoSource,
    removeSource,
    moveSourceLayer,
    toggleVideoLoop,
    toggleCropping,
    renameSource
  };
};
