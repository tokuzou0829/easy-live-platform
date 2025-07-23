"use client";
import React, { useRef, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faVolumeHigh,
  faExpand,
  faCompress,
  faVolumeMute,
  faCopy,
} from "@fortawesome/free-solid-svg-icons";
import Hls from "hls.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface VideoProps {
  id: string;
  className?: string;
}

function Player(props: VideoProps) {
  const { id, className } = props;
  const playerRef = useRef<HTMLDivElement | null>(null);
  const myRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const LinkText = useRef<HTMLInputElement | null>(null);
  const EmdedCode = useRef<HTMLTextAreaElement | null>(null);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>();
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const cursorHideTimeoutRef = useRef<number | null>(null);

  // コンポーネントがアンマウントされたときにクリーンアップ
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.style.cursor = "auto"; // カーソルを表示
    }

    const resetCursorHideTimeout = () => {
      if (cursorHideTimeoutRef.current) {
        clearTimeout(cursorHideTimeoutRef.current);
      }

      cursorHideTimeoutRef.current = window.setTimeout(() => {
        if (playerRef.current && myRef.current!.played) {
         // console.log("hide");
          playerRef.current.style.cursor = "none";
          setShowControls(false);
        }
      }, 3000);
    };

    const handleMouseMove = () => {
      if (playerRef.current) {
        if (playerRef.current.style.cursor == "none") {
          setShowControls(true);
        }
        playerRef.current.style.cursor = "auto"; // オーバーレイ内でのみカーソルを表示
        resetCursorHideTimeout();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (cursorHideTimeoutRef.current) {
        clearTimeout(cursorHideTimeoutRef.current);
      }
    };
  }, []);

  // Load volume from local storage on component mount
  useEffect(() => {
    const initialVolume = window?.localStorage?.getItem("volume") || "1"; // initialVolumeに型を追加
    if (initialVolume !== null) {
      setVolume(parseFloat(initialVolume));
      myRef.current!.volume = parseFloat(initialVolume);
    }
  }, []);

  // Save volume to local storage whenever it changes
  useEffect(() => {
    if (volume) {
      window?.localStorage?.setItem("volume", volume.toString());
    }
  }, [volume]);

  function copyLink() {
    if (LinkText.current) {
      const link = LinkText.current.value;
      return navigator.clipboard.writeText(link);
    }
  }
  function copyEmdedCode() {
    if (EmdedCode.current) {
      const link = EmdedCode.current.value;
      return navigator.clipboard.writeText(link);
    }
  }

  const toggleControls = () => {
    const video = myRef.current!;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };
  const toggleMute = () => {
    const video = myRef.current!;
    if (!video.muted) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
    }
  };
  const handleVideoPlay = () => {
    setIsPlaying(true);
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    myRef.current!.volume = newVolume;
  };

  const handleVideoHoverEnter = () => {
    setIsHovered(true);
    if (playerRef.current && playerRef.current.style.cursor == "auto") {
      setShowControls(true);
    }
  };

  const handleVideoHoverLeave = () => {
    setIsHovered(false);
    if (!myRef.current!.paused) {
      setShowControls(false);
    }
  };

  const enterFullScreen = () => {
    if (playerRef.current) {
      if (playerRef.current.requestFullscreen) {
        playerRef.current.requestFullscreen();
      }
    }
  };
  const exitFullScreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  // フルスクリーンモードの切り替えを監視
  useEffect(() => {
    const handleFullScreenChange = () => {
      if (document.fullscreenElement) {
        setIsFullScreen(true);
      } else {
        setIsFullScreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("mozfullscreenchange", handleFullScreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullScreenChange);
    document.addEventListener("msfullscreenchange", handleFullScreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullScreenChange
      );
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullScreenChange
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleFullScreenChange
      );
    };
  }, []);

  useEffect(() => {
    let hls: Hls; // HLS.js インスタンスを保持する変数を定義
    const videoSrc = `${process.env.NEXT_PUBLIC_BASE_URL}/hls/${id}/index.m3u8`;

    // Function to check the m3u8 file status
    const checkM3u8Status = () => {
      fetch(videoSrc, { method: "HEAD" }).then((response) => {
        if (response.status === 200) {
          console.log("load_video");
          clearInterval(intervalId);
          if (Hls.isSupported()) {
            hls = new Hls({
              enableWorker: true,
              maxBufferLength: 1,
              liveBackBufferLength: 0,
              liveSyncDuration: 0,
              liveMaxLatencyDuration: 5,
              liveDurationInfinity: true,
              highBufferWatchdogPeriod: 1,
            });
            hls.loadSource(videoSrc);
            hls.attachMedia(myRef.current!);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              myRef.current!.currentTime = myRef.current!.duration;
              myRef.current!.play();
            });
          } else {
            const video = myRef.current!;
            video.src = videoSrc;
            video.load();
            myRef.current!.currentTime = myRef.current!.duration;
            video.oncanplay = () => {
              myRef.current!.play();
            };
          }

          myRef.current!.addEventListener("pause", handleVideoPause);
        }
      });
    };
    const intervalId = setInterval(checkM3u8Status, 4000);
    const setUp = setTimeout(checkM3u8Status, 0);
    return () => {
      clearTimeout(setUp);
      clearInterval(intervalId);
      if (hls) {
        hls.destroy(); // HLS.js インスタンスを破棄
      }
    };
  }, []);

  return (
    <div ref={playerRef} className={"w-full relative player " + className}>
      <video
        autoPlay
        webkit-playsinline="true"
        playsInline
        ref={myRef}
        className="w-full h-full bg-black aspect-w-16 aspect-h-9"
        onMouseEnter={handleVideoHoverEnter}
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
      ></video>
      <ContextMenu>
          <div
            ref={overlayRef}
            className={`absolute bottom-0 left-0 h-full w-full transition-opacity duration-300 ease-in-out ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            style={{
              background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 30%)',
            }}
            onMouseLeave={handleVideoHoverLeave}
            onClick={toggleControls}
          >
            {/* Overlay menu */}
            <ContextMenuTrigger>
              <div className="flex items-end h-full mt-[-10px] ml-[10px] relative">
                <input
                  ref={LinkText}
                  className="hidden"
                  readOnly
                  value={`${process.env.NEXT_PUBLIC_BASE_URL}/live/` + id}
                />
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleControls();
                    }}
                    className="text-white"
                  >
                    {isPlaying ? (
                      <FontAwesomeIcon icon={faPause} />
                    ) : (
                      <FontAwesomeIcon icon={faPlay} />
                    )}
                  </button>
                  <div className="flex ml-3 items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="text-white"
                    >
                      {isMuted ? (
                        <FontAwesomeIcon
                          className="text-white"
                          icon={faVolumeMute}
                        />
                      ) : (
                        <FontAwesomeIcon
                          className="text-white"
                          icon={faVolumeHigh}
                        />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={handleVolumeChange}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-[5px] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer bg-gray-700"
                    />
                  </div>
                  <div className="ml-[auto]">
                    {isFullScreen ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exitFullScreen();
                        }}
                        className="absolute bottom-[0px] right-[0px] mt-[-10px] mr-[10px] text-white"
                      >
                        <FontAwesomeIcon icon={faCompress} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          enterFullScreen();
                        }}
                        className="absolute bottom-[0px] right-[0px] mt-[-10px] mr-[10px] text-white"
                      >
                        <FontAwesomeIcon icon={faExpand} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="absolute bg-red-600 w-[100px] h-[25px] top-[20px] right-[10px] rounded-md">
                  <p className=" text-white text-center font-semibold">
                    ライブ配信
                  </p>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  copyLink();
                }}
              >
                <FontAwesomeIcon icon={faCopy} className="mr-[10px]" />
                リンクをコピー
              </ContextMenuItem>
            </ContextMenuContent>
          </div>
      </ContextMenu>
    </div>
  );
}

export default Player;
