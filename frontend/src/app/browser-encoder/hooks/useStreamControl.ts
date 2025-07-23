import { useCallback, useRef, useState } from 'react';
import { VideoSource } from '../types';

interface StreamControlProps {
  streamKey: string;
  ch_pass: string | null;
  videoSourcesRef: React.MutableRefObject<VideoSource[]>;
  mainGainNodeRef: React.MutableRefObject<GainNode | null>;
}

export const useStreamControl = ({
  streamKey,
  ch_pass,
  videoSourcesRef,
  mainGainNodeRef
}: StreamControlProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const wsConnectionRef = useRef<WebSocket | null>(null);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  
  // 再接続関連の状態
  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_INTERVAL = 2000; // 2秒
  const reconnectAttemptsRef = useRef(0);
  const reconnectingRef = useRef(false);

  const createMediaRecorder = (stream: MediaStream) => {
    // Try to use the most efficient codec available
    const codecs = [
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus'
    ];
    
    let selectedMimeType = '';
    for (const mimeType of codecs) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        console.log(`Using codec: ${mimeType}`);
        break;
      }
    }
    
    if (!selectedMimeType) {
      console.error('No supported codec found');
      return null;
    }

    // Optimize encoder settings for stability
    const options = {
      mimeType: selectedMimeType,
      videoBitsPerSecond: 15000000, // Slightly lower bitrate for stability
      audioBitsPerSecond: 192000,  // Higher audio quality
    };
    
    const recorder = new MediaRecorder(stream, options);
    
    // Create a queue system for sending data to avoid overwhelming the WebSocket
    const chunkQueue: Blob[] = [];
    let isSending = false;
    
    const sendNextChunk = async () => {
      if (chunkQueue.length === 0 || isSending || wsConnectionRef.current?.readyState !== WebSocket.OPEN) {
        isSending = false;
        return;
      }
      
      isSending = true;
      const chunk = chunkQueue.shift();
      
      // Make sure chunk is not undefined before sending
      if (chunk) {
        try {
          await wsConnectionRef.current!.send(chunk);
          // Process next chunk after a small delay to allow network to breathe
          setTimeout(() => {
            isSending = false;
            sendNextChunk();
          }, 10);
        } catch (error) {
          console.error('Error sending media chunk:', error);
          isSending = false;
          
          // If sending fails, try to re-queue the chunk if it's important
          if (chunkQueue.length < 10) { // Don't let queue get too large
            chunkQueue.unshift(chunk);
          }
        }
      } else {
        isSending = false;
      }
    };
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && wsConnectionRef.current?.readyState === WebSocket.OPEN) {
        chunkQueue.push(event.data);
        if (!isSending) {
          sendNextChunk();
        }
      }
    };

    recorder.onerror = (event) => {
      if (activeRecorderRef.current === recorder) {
        stopStreaming();
        alert('Recording error occurred. Stream stopped.');
      }
    };
    
    return recorder;
  };

  const startCamera = async (audioContext: AudioContext) => {
    try {
      if (videoSourcesRef.current.length === 0) {
        throw new Error('配信を開始する前に少なくとも 1 つのビデオソースを追加してください');
      }

      // Get the actual canvas element from the DOM
      const canvasElement = document.querySelector('canvas');
      if (!canvasElement) {
        throw new Error('Canvas element not found');
      }
      
      // Capture the stream from the existing canvas
      const canvasStream = (canvasElement as any).captureStream(30);
      if (!canvasStream || !canvasStream.getVideoTracks().length) {
        throw new Error('Failed to capture canvas stream');
      }
      
      // オーディオの設定
      if (!mainGainNodeRef.current) {
        throw new Error('Main gain node not initialized');
      }
      
      // オーディオ出力先を作成
      const audioDestination = audioContext.createMediaStreamDestination();
      mainGainNodeRef.current.connect(audioDestination);
      
      // ビデオとオーディオを結合
      return new MediaStream([
        canvasStream.getVideoTracks()[0],
        audioDestination.stream.getAudioTracks()[0]
      ]);
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  };

  const connectWebSocket = useCallback(() => {
    if (!streamKey.trim() || !currentStreamRef.current) return false;
    
    try {
      wsConnectionRef.current = new WebSocket(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/${streamKey}?password=${ch_pass}`);
      
      wsConnectionRef.current.onopen = () => {
        reconnectAttemptsRef.current = 0; // 接続成功時にリセット
        reconnectingRef.current = false;
        
        const recorder = createMediaRecorder(currentStreamRef.current!);
        if (recorder) {
          activeRecorderRef.current = recorder;
          recorder.start(500);
          setIsStreaming(true);
        }
      };

      wsConnectionRef.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
      };
      
      wsConnectionRef.current.onclose = (event) => {
        // 予期せず接続が切れた場合（すでにstopStreamingが呼ばれている場合を除く）
        if (isStreaming && !reconnectingRef.current) {
          console.log('WebSocket closed unexpectedly, attempting to reconnect...');
          attemptReconnect();
        }
      };
      
      return true;
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      return false;
    }
  }, [streamKey, ch_pass]);
  
  const attemptReconnect = useCallback(() => {
    reconnectingRef.current = true;
    
    if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttemptsRef.current++;
      console.log(`Reconnection attempt ${reconnectAttemptsRef.current} of ${MAX_RECONNECT_ATTEMPTS}...`);
      
      setTimeout(() => {
        // 再接続試行
        if (!connectWebSocket()) {
          attemptReconnect();
        }
      }, RECONNECT_INTERVAL);
    } else {
      // 最大再接続回数に達したらストリーミングを停止
      console.error('Maximum reconnection attempts reached, stopping stream');
      stopStreaming();
      alert('再接続に失敗しました。ストリーミングを停止しました。');
      reconnectingRef.current = false;
    }
  }, [connectWebSocket]);

  const startStreaming = async (audioContext?: AudioContext) => {
    if (!streamKey.trim()) {
      alert('Please enter a stream key');
      return;
    }

    try {
      if (!audioContext) {
        throw new Error('Audio context is required');
      }
      
      const stream = await startCamera(audioContext);
      currentStreamRef.current = stream;
      
      // WebSocket接続を確立
      connectWebSocket();
    } catch (err) {
      console.error('Error starting stream:', err);
      alert(err);
    }
  };

  const stopStreaming = () => {
    reconnectAttemptsRef.current = 0;
    reconnectingRef.current = false;
    
    if (activeRecorderRef.current) {
      activeRecorderRef.current.stop();
      activeRecorderRef.current = null;
    }
    
    if (wsConnectionRef.current) {
      wsConnectionRef.current.close();
      wsConnectionRef.current = null;
    }

    if (currentStreamRef.current) {
      const tracks = currentStreamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      currentStreamRef.current = null;
    }

    setIsStreaming(false);
  };

  return {
    isStreaming,
    startStreaming,
    stopStreaming,
    wsConnectionRef,
    activeRecorderRef
  };
};
