import Video from "./videoframe";
import Chat from "@/components/chat";
import { auth } from "@/auth";
import LiveOverview from "./liveOverview";
import { getLive } from "@/requests/live";
import { MoreVideo } from "@/components/moreVideo";

interface LiveProps {
  id: string;
}

export const revalidate = 180;

export default async function LivePlayer({ id }: LiveProps) {
  const [session, live] = await Promise.all([auth(), getLive({ id })]);

  return (
    <div className="w-full h-full overflow-y-scroll">
      <div className="xl:flex">
        <div className="w-full">
          <Video live={live} />
            <div className="px-2">
              <p className="text-2xl font-bold mt-0">{live.title}</p>
              <LiveOverview live={live} />
            </div>
        </div>
        <div className="p-[10px] xl:min-w-[430px] max-w-[100%] xl:max-w-[430px] xl:pr-[20px]">
          <div>
            <div className="min-h-[600px] mb-4">
              <Chat id={live.id} session={session}></Chat>
            </div>
            <MoreVideo stream={live}></MoreVideo>
          </div>
        </div>
      </div>
    </div>
  );
}
