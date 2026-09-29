import { useState } from "react";
import { Package } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const sizes = {
  xs: "h-7 w-7",
  sm: "h-9 w-9",
  md: "h-11 w-11",
};

export function productImageFileId(
  item?: { images?: { fileId: string }[] | null } | null,
): string | null {
  return item?.images?.[0]?.fileId ?? null;
}

export function ProductThumb({
  fileId,
  name = "Product",
  size = "sm",
  className,
}: {
  fileId?: string | null;
  name?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(fileId) && !failed;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/80 bg-muted/40",
        sizes[size],
        className,
      )}
      title={name}
    >
      {showImage ? (
        <img
          src={api.fileDownloadUrl(fileId!)}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package className={cn("text-muted-foreground/70", size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      )}
    </div>
  );
}
