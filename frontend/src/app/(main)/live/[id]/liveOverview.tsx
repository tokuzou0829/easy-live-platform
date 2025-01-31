"use client";

import { useEffect, useState } from "react";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";
import { ja } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";
import type { Live } from "@/types/live";
import { getLive } from "@/requests/live";
export default function LiveOverview({ live }: { live: Live }) {
  //console.log(live);

  const [status, setStatus] = useState<string>("offline");
  const [streamOverview, setStreamOverview] = useState<string>(
    live.overview
  );
  const [StreamStartTime, setStreamStartTime] = useState<string>(
    live.stream_start_time
  );
  function linkify(text: string) {
    const urlRegex =
      /(\bhttps?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

    return text.split("\n").map((line, index, array) => (
      <span key={index}>
        {line.split(urlRegex).map((part, i) =>
          urlRegex.test(part) ? (
            <a
              href={part}
              key={i}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500"
            >
              {part}
            </a>
          ) : (
            part
          )
        )}
        {index !== array.length - 1 && <br />}
      </span>
    ));
  }

  function formatDate(StreamStartTimeData: string): string {
    if (StreamStartTimeData) {
      const timeZone = "Asia/Tokyo";
      const zonedDate = utcToZonedTime(StreamStartTimeData, timeZone);
      return (
        formatDistanceToNowStrict(zonedDate, { locale: ja }) + "前に配信開始"
      );
    } else {
      return "ストリーマーを待機中";
    }
  }

  useEffect(() => {
    const id = setInterval(ChecksStatus, 10000);
    return () => clearInterval(id);
  }, []);

  async function ChecksStatus() {
    if (status !== "online") {
      const res = await getLive({ id: live.stream_key });
      setStatus(res.status);
      setStreamOverview(res.overview);
      setStreamStartTime(res.stream_start_time);
    }
  }
  return (
    <div className="p-[10px] bg-slate-100 mt-3 rounded-lg">
      <p className="font-bold text-slate-900	">{formatDate(StreamStartTime)}</p>
      <p className="mb-0">{linkify(streamOverview)}</p>
    </div>
  );
}
