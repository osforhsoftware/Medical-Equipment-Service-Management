import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APPROVED_IMAGE_ACCEPT, keepApprovedFiles } from "@/lib/uploadFileTypes";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export type SignatureCaptureMode = "draw" | "upload";

interface SignaturePadProps {
  /** Called whenever the signature data URL changes (draw stroke end or image upload). */
  onChange: (dataUrl: string | null) => void;
  /** Existing signature to show (e.g. when editing a saved report). */
  value?: string | null;
  /** Accessible name for the capture surface. */
  ariaLabel?: string;
  className?: string;
  /** Starting capture tab. */
  defaultMode?: SignatureCaptureMode;
}

const MAX_UPLOAD_EDGE = 720;

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to process signature image"));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read signature image"));
    };
    image.src = objectUrl;
  });
}

export function SignaturePad({
  onChange,
  value = null,
  ariaLabel = "Signature",
  className,
  defaultMode = "draw",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const previewRef = useRef<string | null>(value ?? null);
  const [mode, setMode] = useState<SignatureCaptureMode>(defaultMode);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const inputId = useId();

  useEffect(() => {
    previewRef.current = value ?? null;
    setPreview(value ?? null);
  }, [value]);

  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
    canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    const current = previewRef.current;
    if (current?.startsWith("data:image")) {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, bounds.width, bounds.height);
        context.drawImage(image, 0, 0, bounds.width, bounds.height);
      };
      image.src = current;
    }
  }, [mode]);

  const emit = (dataUrl: string | null) => {
    previewRef.current = dataUrl;
    setPreview(dataUrl);
    onChange(dataUrl);
  };

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    emit(event.currentTarget.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    if (fileInputRef.current) fileInputRef.current.value = "";
    emit(null);
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const { allowed, error } = keepApprovedFiles(files, true);
    if (error) toast.error(error);
    const file = allowed[0];
    if (!file) {
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      emit(dataUrl);
    } catch {
      toast.error("Unable to read that signature image. Try a PNG, JPEG, or WebP file.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Tabs
        value={mode}
        onValueChange={(next) => setMode(next as SignatureCaptureMode)}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw" className="gap-1.5">
            <PenLine className="h-3.5 w-3.5" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-2 space-y-2">
          <canvas
            ref={canvasRef}
            className="h-40 w-full touch-none rounded-lg border border-dashed border-border bg-white"
            aria-label={`Draw ${ariaLabel}`}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
          />
          <p className="text-xs text-muted-foreground">Draw the signature on the pad above.</p>
        </TabsContent>

        <TabsContent value="upload" className="mt-2 space-y-2">
          {preview ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-white p-3">
              <img
                src={preview}
                alt={`${ariaLabel} preview`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <label
              htmlFor={inputId}
              className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center transition-colors hover:bg-muted/50"
            >
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Upload signature image</span>
              <span className="text-xs text-muted-foreground">PNG, JPEG, or WebP</span>
            </label>
          )}
          <input
            id={inputId}
            ref={fileInputRef}
            type="file"
            accept={APPROVED_IMAGE_ACCEPT}
            className="sr-only"
            onChange={onFileChange}
          />
          {preview ? (
            <div className="flex justify-start">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Replace image
              </Button>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={!preview}>
          Clear signature
        </Button>
      </div>
    </div>
  );
}
