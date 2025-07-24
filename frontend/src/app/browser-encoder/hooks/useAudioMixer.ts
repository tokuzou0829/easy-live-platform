import { useRef, useState, useEffect } from 'react';
import { AudioSource, AudioSourceState } from '../types';

export const useAudioMixer = () => {
  const [audioSources, setAudioSources] = useState<{[key: string]: AudioSourceState}>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMixerRef = useRef<{[key: string]: AudioSource}>({});
  const mainGainNodeRef = useRef<GainNode | null>(null);
  const streamTracksRef = useRef<{[key: string]: MediaStreamTrack[]}>({});

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
    silentGain.gain.value = 0;
    silentOscillator.connect(silentGain);
    silentGain.connect(mainGainNodeRef.current);
    silentOscillator.start();

    mainGainNodeRef.current.connect(destination);
    return { destination, mainGain: mainGainNodeRef.current };
  };

  const startLevelMeter = (sourceId: string, analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      if (!audioMixerRef.current[sourceId]) return;
  
      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      const numFrequencies = dataArray.length;
      
      for (let i = 0; i < numFrequencies; i++) {
        sum += dataArray[i];
      }
      
      const average = sum / numFrequencies;
      const normalizedLevel = Math.min(average / 128, 1.0);
  
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

  const addAudioSource = (sourceId: string, stream: MediaStream | null, options: { name: string, type: 'mic' | 'audio' | 'screen' }) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    // If we're adding a mic source, store the tracks for later cleanup
    if (stream && options.type === 'mic') {
      const tracks = stream.getAudioTracks();
      if (tracks.length > 0) {
        streamTracksRef.current[sourceId] = tracks;
      }
    }

    if (stream && stream.getAudioTracks().length === 0) return;

    const gainNode = audioContextRef.current.createGain();
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    
    if (stream) {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(gainNode);
    }
    
    gainNode.connect(analyser);
    gainNode.gain.value = 1.0;
    
    if (!mainGainNodeRef.current) {
      const { mainGain } = initAudioMixer();
      mainGainNodeRef.current = mainGain;
    }
    
    gainNode.connect(mainGainNodeRef.current);

    audioMixerRef.current[sourceId] = {
      gain: gainNode,
      volume: 1.0,
      muted: false,
      analyser,
      name: options.name,
      type: options.type
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

  const updateAudioVolume = (sourceId: string, volume: number) => {
    const mixer = audioMixerRef.current[sourceId];
    if (mixer) {
      mixer.volume = volume;
      if (!mixer.muted) {
        mixer.gain.gain.setValueAtTime(volume, audioContextRef.current!.currentTime);
      }
      
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

  const playAudio = (sourceId: string) => {
    const mixer = audioMixerRef.current[sourceId];
    if (mixer && mixer.audioElement) {
      mixer.audioElement.play();
    }
  };

  const pauseAudio = (sourceId: string) => {
    const mixer = audioMixerRef.current[sourceId];
    if (mixer && mixer.audioElement) {
      mixer.audioElement.pause();
    }
  };

  const removeAudioSource = (sourceId: string) => {
    if (audioMixerRef.current[sourceId]) {
      console.log(`Removing audio source: ${sourceId}`);
      
      // Handle audio element if it exists
      if (audioMixerRef.current[sourceId].audioElement) {
        audioMixerRef.current[sourceId].audioElement.pause();
        audioMixerRef.current[sourceId].audioElement.src = '';
      }
      
      // Properly disconnect the gain node
      audioMixerRef.current[sourceId].gain.disconnect();
      
      // If this is a microphone source, stop all tracks
      if (sourceId.startsWith('mic-') && streamTracksRef.current[sourceId]) {
        streamTracksRef.current[sourceId].forEach(track => {
          track.stop();
          console.log(`Stopped track for source: ${sourceId}`);
        });
        delete streamTracksRef.current[sourceId];
      }
      
      // Remove from the mixer reference
      delete audioMixerRef.current[sourceId];
      
      // Update state
      setAudioSources(prev => {
        const newSources = { ...prev };
        delete newSources[sourceId];
        return newSources;
      });
    }
  };
  
  // Listen for video source removal events to clean up associated audio sources
  useEffect(() => {
    const handleVideoSourceRemoved = (event: CustomEvent) => {
      const { sourceId } = event.detail;
      console.log(`Video source removed event received: ${sourceId}`);
      
      // Remove the corresponding audio source if it exists (exact match)
      if (audioSources[sourceId]) {
        removeAudioSource(sourceId);
      }
      
      // Only remove audio sources that are directly related to this specific video source
      // Check for audio sources that start with the exact sourceId (e.g., "screen-123456" matches "screen-123456-audio")
      Object.keys(audioSources).forEach(audioId => {
        if (audioId.startsWith(sourceId + '-') || audioId === sourceId) {
          removeAudioSource(audioId);
        }
      });
    };
    
    // Add event listener
    document.addEventListener('videoSourceRemoved', handleVideoSourceRemoved as EventListener);
    
    // Clean up
    return () => {
      document.removeEventListener('videoSourceRemoved', handleVideoSourceRemoved as EventListener);
    };
  }, [audioSources]);

  return {
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
    audioMixerRef,
    mainGainNodeRef
  };
};
