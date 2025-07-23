import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { AudioSourceState } from '../types';

interface AudioMixerProps {
  audioSources: { [key: string]: AudioSourceState };
  onUpdateVolume: (sourceId: string, volume: number) => void;
  onToggleMute: (sourceId: string) => void;
  onToggleLoop: (sourceId: string) => void;
  onPlayAudio: (sourceId: string) => void;
  onPauseAudio: (sourceId: string) => void;
}

export const AudioMixer: React.FC<AudioMixerProps> = ({
  audioSources,
  onUpdateVolume,
  onToggleMute,
  onToggleLoop,
  onPlayAudio,
  onPauseAudio,
}) => {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Audio Mixer</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          {Object.entries(audioSources).map(([sourceId, { volume, muted, loop, name, level }]) => (
            <div key={sourceId} className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  {name}
                </span>
                <div className="flex gap-2">
                  {sourceId.startsWith('audio-') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleLoop(sourceId)}
                      >
                        {loop ? 'Loop: On' : 'Loop: Off'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPlayAudio(sourceId)}
                      >
                        ▶
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPauseAudio(sourceId)}
                      >
                        ⏸
                      </Button>
                    </>
                  )}
                  <Button
                    variant={muted ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => onToggleMute(sourceId)}
                  >
                    {muted ? 'Unmute' : 'Mute'}
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="relative">
                  <Slider
                    value={[volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={muted}
                    onValueChange={(values: number[]) => onUpdateVolume(sourceId, values[0])}
                    className="z-10 relative"
                  />
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden">
                  <div className="relative w-full h-full">
                    <div 
                      className="absolute inset-0 transition-all duration-0"
                      style={{
                        width: `${(level || 0) * 100}%`,
                        backgroundColor: `hsl(${120 - (level || 0) * 120}, 100%, 50%)`
                      }}
                    />
                    <div className="absolute inset-0 flex justify-between px-1 text-[8px] text-white/50">
                      <span>-inf</span>
                      <span>-40</span>
                      <span>-20</span>
                      <span>-10</span>
                      <span>0dB</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Level: {Math.round((level || 0) * 100)}%</span>
                  <span>Volume: {Math.round(volume * 100)}%</span>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
