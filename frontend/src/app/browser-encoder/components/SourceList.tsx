import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Plus, Video, Mic, Monitor, Image as ImageIcon, Music, Scissors } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { VideoSource, AudioSourceState, DeviceList, ScreenShareSettings } from '../types';

interface SourceListProps {
  videoSources: VideoSource[];
  audioSources: { [key: string]: AudioSourceState };
  devices: DeviceList;
  selectedSourceId: string | null;
  isScreenSharing: boolean;
  editingName: string | null;
  screenShareSettings: ScreenShareSettings;
  onAddVideoSource: (type: 'camera' | 'screen', deviceId?: string) => void;
  onAddAudioSource: (deviceId: string) => void;
  onAddImageSource: () => void;
  onAddAudioFileSource: () => void;
  onAddVideoFile: () => void;
  onRemoveSource: (sourceId: string) => void;
  onMoveSourceLayer: (sourceId: string, direction: 'up' | 'down') => void;
  onToggleVideoLoop: (sourceId: string) => void;
  onToggleCropping: (sourceId: string) => void;
  onRenameSource: (sourceId: string, newName: string) => void;
  onEditingNameChange: (sourceId: string | null) => void;
  onScreenShareSettingsChange: (settings: Partial<ScreenShareSettings>) => void;
}

export const SourceList: React.FC<SourceListProps> = ({
  videoSources,
  audioSources,
  devices,
  selectedSourceId,
  isScreenSharing,
  editingName,
  screenShareSettings,
  onAddVideoSource,
  onAddAudioSource,
  onAddImageSource,
  onAddAudioFileSource,
  onAddVideoFile,
  onRemoveSource,
  onMoveSourceLayer,
  onToggleVideoLoop,
  onToggleCropping,
  onRenameSource,
  onEditingNameChange,
  onScreenShareSettingsChange,
}) => {
  return (
    <Card className="flex-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sources</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Video className="h-4 w-4 mr-2" />
                <span>カメラを追加</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {devices.videoInputs.map(device => (
                    <DropdownMenuItem 
                      key={device.deviceId}
                      onSelect={() => onAddVideoSource('camera', device.deviceId)}
                    >
                      {device.label || `Camera ${device.deviceId}`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Mic className="h-4 w-4 mr-2" />
                <span>マイクを追加</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {devices.audioInputs.map(device => (
                    <DropdownMenuItem 
                      key={device.deviceId}
                      onSelect={() => onAddAudioSource(device.deviceId)}
                    >
                      {device.label || `Microphone ${device.deviceId}`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuItem asChild>
              <Dialog>
                <DialogTrigger asChild>
                  <div className="flex items-center px-2 py-1.5 text-sm">
                    <Monitor className="h-4 w-4 mr-2" />
                    <span>画面を追加</span>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>画面共有の設定</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        元のアスペクト比を維持
                      </label>
                      <Switch
                        checked={screenShareSettings.maintainAspectRatio}
                        onCheckedChange={(checked: boolean) => 
                          onScreenShareSettingsChange({ maintainAspectRatio: checked })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">解像度</label>
                      <RadioGroup
                        value={screenShareSettings.resolution}
                        onValueChange={(value: '720p' | '1080p') =>
                          onScreenShareSettingsChange({ resolution: value })
                        }
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="720p" id="screenshare-720p" />
                          <Label htmlFor="screenshare-720p">720p</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="1080p" id="screenshare-1080p" />
                          <Label htmlFor="screenshare-1080p">1080p</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <DialogClose asChild>
                      <Button 
                        className="w-full" 
                        onClick={() => onAddVideoSource('screen')}
                      >
                        画面共有を開始
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={onAddImageSource}>
              <ImageIcon className="h-4 w-4 mr-2" />
              <span>画像を追加</span>
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={onAddAudioFileSource}>
              <Music className="h-4 w-4 mr-2" />
              <span>音声ファイルを追加</span>
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={onAddVideoFile}>
              <Video className="h-4 w-4 mr-2" />
              <span>動画ファイルを追加</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          {/* 映像ソース */}
          {videoSources.map((source, index) => (
            <div 
              key={source.id} 
              className={`flex items-center justify-between p-2 rounded-lg mb-2 ${
                source.id === selectedSourceId ? 'bg-accent' : 'bg-card'
              }`}
            >
              <div className="flex items-center gap-2">
                {source.id.startsWith('camera-') && <Video className="h-4 w-4" />}
                {source.id.startsWith('screen-') && <Monitor className="h-4 w-4" />}
                {source.id.startsWith('image-') && <ImageIcon className="h-4 w-4" />}
                {source.id.startsWith('video-') && <Video className="h-4 w-4" />}
                {editingName === source.id ? (
                  <Input
                    className="h-6 w-40"
                    value={source.name}
                    autoFocus
                    onChange={(e) => onRenameSource(source.id, e.target.value)}
                    onBlur={() => onEditingNameChange(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onEditingNameChange(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    className="cursor-pointer hover:bg-accent/50 px-2 py-1 rounded min-w-[160px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditingNameChange(source.id);
                    }}
                  >
                    {source.name}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {(source.id.startsWith('video-') || source.isAnimated) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleVideoLoop(source.id)}
                  >
                    {source.loop ? 'Loop: On' : 'Loop: Off'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleCropping(source.id)}
                >
                  <Scissors className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onMoveSourceLayer(source.id, 'up')}
                  disabled={index === 0}
                >
                  ↑
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onMoveSourceLayer(source.id, 'down')}
                  disabled={index === videoSources.length - 1}
                >
                  ↓
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => onRemoveSource(source.id)}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}

          {/* 音声ソース */}
          {Object.entries(audioSources)
            .filter(([id]) => !id.startsWith('screen-'))
            .map(([sourceId, source]) => (
              <div 
                key={sourceId}
                className="flex items-center justify-between p-2 rounded-lg mb-2 bg-card"
              >
                <div className="flex items-center gap-2">
                  {source.type === 'mic' && <Mic className="h-4 w-4" />}
                  {source.type === 'audio' && <Music className="h-4 w-4" />}
                  {editingName === sourceId ? (
                    <Input
                      className="h-6 w-40"
                      value={source.name}
                      autoFocus
                      onChange={(e) => onRenameSource(sourceId, e.target.value)}
                      onBlur={() => onEditingNameChange(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onEditingNameChange(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span 
                      className="cursor-pointer hover:bg-accent/50 px-2 py-1 rounded min-w-[160px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditingNameChange(sourceId);
                      }}
                    >
                      {source.name}
                    </span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => onRemoveSource(sourceId)}
                >
                  ×
                </Button>
              </div>
            ))}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
