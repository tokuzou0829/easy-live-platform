"use client";

import { useState } from "react";
import { ExternalLinkIcon, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

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
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/streams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, overview }),
      });

      const data = await response.json();
      setStreamData(data);
      localStorage.setItem("stream_key", data.stream_key);
      localStorage.setItem("stream_access_key", data.stream_access_key);
    } catch (error) {
      console.error("Error creating stream:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowserEncoder = () => {
    setShowConfirmation(true);
  };

  const handleConfirmedNavigation = () => {
    setShowConfirmation(false);
    setOpen(false);
    window.open(`/browser-encoder?stream_key=${streamData?.stream_key}`, '_blank');
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
                  {process.env.NEXT_PUBLIC_RTMP_URL}?password={streamData.stream_access_key}
                </code>
              </div>
              <div className="space-y-2">
                <p>ストリームキー:</p>
                <code className="block p-2 bg-gray-100 rounded">
                  {streamData.stream_key}
                </code>
                <span className="text-gray-500">OBSなどのお好きなアプリから配信を開始できます</span>
              </div>
              <Link href="#" onClick={(e) => {
                e.preventDefault();
                handleBrowserEncoder();
              }}>
                <Button>
                  ブラウザから配信を始める
                  <ExternalLinkIcon className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ブラウザ配信(β)に関する注意</DialogTitle>
          <DialogDescription>
            ブラウザからの配信は実験的な機能で、以下の制限があります：
            <ul className="list-disc pl-6 mt-2">
              <li>配信が不安定になる可能性があります</li>
              <li>画質や音質が低下する可能性があります</li>
              <li>もし配信がすぐにホームに表示されない、配信の画質があまりにも低い場合は一度配信を停止して開始ボタンを押して配信をやり直してください</li>
            </ul>
            安定した配信には、OBSなどの専用ソフトウェアの使用を推奨します。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowConfirmation(false)}>
            キャンセル
          </Button>
          <Button onClick={handleConfirmedNavigation}>
            理解して続ける
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
