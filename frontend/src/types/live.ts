export type LiveProps = {
  id: string;
};

export type Live = {
  id: number;
  title: string;
  status: "online" | "offline";
  stream_key: string;
  overview: string;
  stream_start_time: string
};