import { Check, Info, Loader2, AlertTriangle, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import type { ComponentProps, ReactNode } from "react";

type ToasterProps = ComponentProps<typeof Sonner>;

function ToastGlyph({
  tone,
  children,
}: {
  tone: "success" | "error" | "warning" | "info" | "loading";
  children: ReactNode;
}) {
  return (
    <span className={`mesms-toast-glyph mesms-toast-glyph-${tone}`} aria-hidden>
      {children}
    </span>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      gap={12}
      visibleToasts={5}
      closeButton
      richColors={false}
      expand={false}
      offset={{
        top: "max(1rem, env(safe-area-inset-top))",
        right: "max(1rem, env(safe-area-inset-right))",
      }}
      mobileOffset={{
        top: "max(0.75rem, env(safe-area-inset-top))",
        right: "0.75rem",
        left: "0.75rem",
      }}
      duration={4000}
      containerAriaLabel="Notifications"
      toastOptions={{
        classNames: {
          toast: "group toast mesms-toast",
          title: "mesms-toast-title",
          description: "mesms-toast-description",
          icon: "mesms-toast-icon",
          content: "mesms-toast-content",
          closeButton: "mesms-toast-close",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      icons={{
        success: (
          <ToastGlyph tone="success">
            <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
          </ToastGlyph>
        ),
        error: (
          <ToastGlyph tone="error">
            <X className="h-3.5 w-3.5" strokeWidth={2.75} />
          </ToastGlyph>
        ),
        warning: (
          <ToastGlyph tone="warning">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} />
          </ToastGlyph>
        ),
        info: (
          <ToastGlyph tone="info">
            <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
          </ToastGlyph>
        ),
        loading: (
          <ToastGlyph tone="loading">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
          </ToastGlyph>
        ),
        close: <X className="h-3.5 w-3.5" strokeWidth={2.25} />,
      }}
      {...props}
    />
  );
};

export { Toaster };
