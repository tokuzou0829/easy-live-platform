"use client";

import { useState } from "react";
import { Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface StreamResponse {
  id: number;
  title: string;
  stream_key: string;
  stream_access_key: string;
  overview: string | null;
}

export function NewStreamDialog({ isCollapsed }: { isCollapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [streamData, setStreamData] = useState<StreamResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("https://live-platform-api.tokuzou.me/streams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, overview }),
      });

      const data = await response.json();
      setStreamData(data);
    } catch (error) {
      console.error("Error creating stream:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            buttonVariants({ variant: "ghost", size: isCollapsed ? "icon" : "sm" }),
            isCollapsed ? "h-9 w-9" : "justify-start"
          )}
        >
          <Radio className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
          {!isCollapsed && (streamData ? "情報を確認":"配信を開始")}
        </button>
      </DialogTrigger>
      <DialogContent>
        {!streamData ? (
          <>
            <DialogHeader>
              <DialogTitle>配信を開始</DialogTitle>
              <span className="text-gray-500">配信を作るのにアカウントは必要ありません！<br />今すぐ始めましょう！</span>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="title">タイトル</label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="overview">概要</label>
                <Textarea
                  id="overview"
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "作成中..." : "配信を作成"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>配信が作成されました！</DialogTitle>
              <span className="text-gray-500">この情報はタブを再読み込みするまで保存されています！<br />URLやストリームキーを無くした場合は枠を立て直してください</span>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p>ストリームURL:</p>
                <code className="block p-2 bg-gray-100 rounded">
                  rtmp://rtmp.live-platform.tokuzou.me/lptlive2?password={streamData.stream_access_key}
                </code>
              </div>
              <div className="space-y-2">
                <p>ストリームキー:</p>
                <code className="block p-2 bg-gray-100 rounded">
                  {streamData.stream_key}
                </code>
                <span className="text-gray-500">OBSなどのお好きなアプリから配信を開始できます</span>
              </div>
              <Button onClick={() => setOpen(false)}>閉じる</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
