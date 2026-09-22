import { Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildGmailComposeUrl,
  buildMailtoUrl,
  buildWhatsAppShareUrl,
  sanitizeWhatsAppPhone,
} from "@/lib/inspectionShare";
import { toast } from "@/lib/toast";

interface ShareButtonsProps {
  message: string;
  subject?: string;
  phone?: string | null;
  email?: string | null;
  className?: string;
}

export function ShareButtons({
  message,
  subject = "Document Details",
  phone,
  email,
  className = "",
}: ShareButtonsProps) {
  const handleWhatsApp = () => {
    const cleanPhone = sanitizeWhatsAppPhone(phone);
    if (!cleanPhone) {
      // If no valid phone number provided, open generic wa.me share line
      const genericUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(genericUrl, "_blank", "noopener,noreferrer");
      toast.success("Opened WhatsApp share");
      return;
    }
    const url = buildWhatsAppShareUrl(cleanPhone, message);
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Opened WhatsApp chat");
  };

  const handleEmail = () => {
    const cleanEmail = email?.trim() ?? "";
    if (cleanEmail && cleanEmail.includes("@")) {
      const gmailUrl = buildGmailComposeUrl({ to: cleanEmail, subject, body: message });
      const popup = window.open(gmailUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.href = buildMailtoUrl({ to: cleanEmail, subject, body: message });
      }
      toast.success("Opened email client");
    } else {
      const gmailUrl = buildGmailComposeUrl({ to: "", subject, body: message });
      const popup = window.open(gmailUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.href = buildMailtoUrl({ to: "", subject, body: message });
      }
      toast.success("Opened email client");
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleWhatsApp}
        className="gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
      >
        <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
        WhatsApp
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleEmail}
        className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <Mail className="h-3.5 w-3.5 text-red-500" />
        Gmail / Email
      </Button>
    </div>
  );
}
