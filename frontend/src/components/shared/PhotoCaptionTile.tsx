import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhotoCaptionTileProps {
  src: string;
  alt: string;
  caption: string;
  onCaptionChange?: (value: string) => void;
  onRemove?: () => void;
  href?: string;
  readOnly?: boolean;
  className?: string;
}

export function PhotoCaptionTile({
  src,
  alt,
  caption,
  onCaptionChange,
  onRemove,
  href,
  readOnly = false,
  className,
}: PhotoCaptionTileProps) {
  const image = (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted">
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/70 text-background"
          aria-label={`Remove ${alt}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" title={alt} onClick={(e) => e.stopPropagation()}>
          {image}
        </a>
      ) : (
        image
      )}
      {readOnly ? (
        caption ? (
          <p className="truncate px-0.5 text-[11px] leading-tight text-muted-foreground" title={caption}>
            {caption}
          </p>
        ) : null
      ) : (
        <Input
          value={caption}
          onChange={(e) => onCaptionChange?.(e.target.value.slice(0, 500))}
          placeholder="Time or note"
          className="h-8 px-2 text-xs"
          aria-label={`Time or note for ${alt}`}
        />
      )}
    </div>
  );
}
