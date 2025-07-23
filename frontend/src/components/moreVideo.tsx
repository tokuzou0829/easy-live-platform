import { getOnlineLiveList } from "@/requests/live";
import { auth } from "@/auth";
import { Live } from "@/types/live";
import Link from "next/link";
export async function MoreVideo({stream}:{stream :Live}) {
    const [session, videos] = await Promise.all([auth(), getOnlineLiveList()]);
    return (
        <>
            <div className="w-[100%]">
                <p className=" font-bold text-[20px]">配信をもっと見る</p>
                {videos && videos.lives.map((video,index) => (
                    <>
                        {video.stream_key !== stream.stream_key && (
                            <div key={index}>
                                <Link href={`/live/${video.stream_key}`}>
                                    <div className="flex items-center my-[5px]">
                                        <img className="object-cover w-[140px] aspect-video rounded" src={`${process.env.NEXT_PUBLIC_THUMBNAIL_URL}?id=${video.stream_key}`}></img>
                                        <div className="ml-2 mr-2">
                                            <span className="text-ellipsis-2">{video.title}</span>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        )}
                    </>
                ))}
            </div>
        </>
    );
}