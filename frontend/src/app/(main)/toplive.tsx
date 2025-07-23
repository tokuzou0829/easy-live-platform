"use client";
import { useState } from "react";
import Link from "next/link";
import "./in.css";
import Player from "./live/[id]/player";
import type { Live } from "@/types/live";
import { ArrowRightCircle } from "lucide-react";

interface OptionProps {
  image: string;
  sub: string;
  video_id: string;
  active: boolean;
  onClick: () => void;
  style: { [key: string]: string };
}

type LiveProps = {
  lives: Live[];
};
function Option({
  image,
  sub,
  active,
  onClick,
  style,
  video_id,
}: OptionProps) {
  const optionClass = active ? "option active" : "option";

  return (
    <div className={optionClass} style={style} onClick={onClick}>
      {active && (
        <>
          <Player id={video_id} className={"absolute h-[100%]"}></Player>
          <Link
            href={"/live/" + video_id}
            className="absolute bottom-0 right-0 text-white m-[10px] font-bold p-[10px] rounded-full bg-opacity-60 bg-black"
          >
            配信を見る
          </Link>
        </>
      )}
      <Link href={'/live/' + video_id}>
        <div className="label">
          {active && (
            <div className="info">
              <div className="sub">{sub}</div>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

function TopLive(props: LiveProps) {
  const [activeOption, setActiveOption] = useState<number>(0);
  const { lives } = props;

  const handleOptionClick = (index: number) => {
    setActiveOption(index);
  };

  return (
    <div className="options h-full w-full items-center">
      {lives.map((option, index) => (
        <Option
          key={index}
          image={`${process.env.NEXT_PUBLIC_THUMBNAIL_URL}?id=${option.stream_key}`}
          sub={option.title}
          video_id={option.stream_key}
          active={index === activeOption}
          onClick={() => handleOptionClick(index)}
          style={{ "--optionBackground": `url(${process.env.NEXT_PUBLIC_THUMBNAIL_URL}?id=${option.stream_key})` }}
        />
      ))}
      <div className=" shrink-0">
        <p>次の配信をまっています!</p>
        <ArrowRightCircle size={32} className="mx-auto" />
      </div>
    </div>
  );
}

export default TopLive;
