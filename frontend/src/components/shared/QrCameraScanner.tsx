import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DetectedBarcode = { rawValue: string };
type Detector = { detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]> };

function createDetector(): Detector | null {
  const Detector = (window as Window & {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export function QrCameraScanner({
  onDetect,
  disabled = false,
  className,
}: {
  onDetect: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const onDetectRef = useRef(onDetect);
  const lastValueRef = useRef("");
  const lastAtRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && Boolean(createDetector());

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  };

  const emit = (value: string) => {
    const next = value.trim();
    if (!next || disabled) return;
    const now = Date.now();
    if (next === lastValueRef.current && now - lastAtRef.current < 2500) return;
    lastValueRef.current = next;
    lastAtRef.current = now;
    onDetectRef.current(next);
  };

  const scanLoop = async (detector: Detector) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      frameRef.current = requestAnimationFrame(() => void scanLoop(detector));
      return;
    }
    try {
      const codes = await detector.detect(video);
      const value = codes.find((code) => code.rawValue)?.rawValue;
      if (value) emit(value);
    } catch {
      /* keep scanning */
    }
    if (streamRef.current) {
      frameRef.current = requestAnimationFrame(() => void scanLoop(detector));
    }
  };

  const startCamera = async () => {
    setError(null);
    const detector = createDetector();
    if (!detector) {
      setError("Camera QR scanning needs Chrome or Edge on this device.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Camera access needs localhost or HTTPS.");
      return;
    }
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      lastValueRef.current = "";
      setRunning(true);
      frameRef.current = requestAnimationFrame(() => void scanLoop(detector));
    } catch {
      setError("Camera permission was denied, or no camera is available.");
      stopCamera();
    } finally {
      setBusy(false);
    }
  };

  const scanImageFile = async (file: File) => {
    const detector = createDetector();
    if (!detector) {
      setError("QR image scanning needs Chrome or Edge on this device.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const value = codes.find((code) => code.rawValue)?.rawValue;
      if (!value) {
        setError("No QR code found in that image.");
        return;
      }
      emit(value);
    } catch {
      setError("Unable to read that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40">
        <video
          ref={videoRef}
          className={cn("absolute inset-0 h-full w-full object-cover", running ? "block" : "hidden")}
          playsInline
          muted
        />
        {!running ? (
          <div className="px-4 text-center text-muted-foreground">
            <Camera className="mx-auto h-12 w-12" />
            <p className="mt-2 text-xs">Point the camera at the equipment QR code</p>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-10 rounded-lg border-2 border-primary/80" />
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!supported ? (
        <p className="text-xs text-muted-foreground">Live QR scan works in Chrome or Edge. You can still type the asset tag below.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {running ? (
          <Button type="button" variant="outline" onClick={stopCamera} disabled={disabled}>
            <CameraOff className="h-4 w-4" /> Stop camera
          </Button>
        ) : (
          <Button type="button" variant="brand" onClick={() => void startCamera()} disabled={disabled || busy || !supported}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Start camera
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={disabled || busy || !supported}>
          <ImagePlus className="h-4 w-4" /> Upload QR image
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void scanImageFile(file);
          }}
        />
      </div>
    </div>
  );
}
