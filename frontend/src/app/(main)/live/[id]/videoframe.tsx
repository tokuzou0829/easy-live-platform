"use client";
import React, { useState, useEffect } from "react";
import Video from "./player";
import type { Live } from "@/types/live";
import { getLive } from "@/requests/live";

type Flameprops = {
  live: Live;
};

export default function Videoflame(props: Flameprops) {
  const { live } = props;
  const [status, setStatus] = useState<string>(live.status);

  useEffect(() => {
    let archivecheckstatus = false;
    async function ChecksStatus() {
      if (status !== "online") {
        const res = await getLive({ id: live.stream_key });
        setStatus(res.status);
      }
    }
    const id = setInterval(ChecksStatus, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-[100%] p-[10px]">
      <div className="rounded-[10px] overflow-hidden">
        {status == "online" ? (
          <Video id={live.stream_key} />
        ) : (
          <div className="relative w-[100%] aspect-video" style={{ backgroundImage: `url(${process.env.NEXT_PUBLIC_THUMBNAIL_URL}?id=${live.stream_key})` ,backgroundSize: "cover"}}>
            <div
              style={{
                position: "absolute",
                backgroundColor: "rgba(0,0,0,0.6)",
                left: 0,
                bottom: 0,
                margin: 10,
                padding: 10,
                borderRadius: 10,
              }}
            >
              <p className="text-white">ストリーマーを待っています</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
