import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface StreamControlsProps {
  streamTitle: string | null;
  isStreaming: boolean;
  resolution: '720p' | '1080p';
  onResolutionChange: (resolution: '720p' | '1080p') => void;
  onStartStreaming: () => void;
  onStopStreaming: () => void;
}

export const StreamControls: React.FC<StreamControlsProps> = ({
  streamTitle,
  isStreaming,
  resolution,
  onResolutionChange,
  onStartStreaming,
  onStopStreaming,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{streamTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-[20px]">
        <div className="flex gap-4 items-center">
          <RadioGroup
            defaultValue={resolution}
            onValueChange={(value) => onResolutionChange(value as '720p' | '1080p')}
            className="flex items-center space-x-4"
            disabled={isStreaming}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="720p" 
                id="720p"
                disabled={isStreaming}
              />
              <Label 
                htmlFor="720p" 
                className={isStreaming ? "text-muted-foreground" : ""}
              >
                720p
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="1080p" 
                id="1080p"
                disabled={isStreaming}
              />
              <Label 
                htmlFor="1080p"
                className={isStreaming ? "text-muted-foreground" : ""}
              >
                1080p
              </Label>
            </div>
          </RadioGroup>
          <div className='ml-auto'>
            {!isStreaming ? (
              <Button onClick={onStartStreaming} disabled={isStreaming}>
                配信開始
              </Button>
            ) : (
              <Button 
                onClick={onStopStreaming} 
                disabled={!isStreaming}
                variant="destructive"
              >
                配信停止
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
