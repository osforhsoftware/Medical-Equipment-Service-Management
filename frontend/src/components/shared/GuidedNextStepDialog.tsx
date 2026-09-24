import { useRef } from "react";
import { HardDrive, Ticket } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type GuidedStep = "equipment" | "ticket";

type GuidedNextStepDialogProps = {
  open: boolean;
  step: GuidedStep;
  subjectName: string;
  onConfirm: () => void;
  onSkip: () => void;
};

const COPY: Record<GuidedStep, {
  icon: typeof HardDrive;
  title: (name: string) => string;
  description: (name: string) => string;
  confirm: string;
}> = {
  equipment: {
    icon: HardDrive,
    title: (name) => `Register equipment for ${name}?`,
    description: (name) =>
      `${name} is saved. Add their machine next — the customer will already be selected. You can skip and register equipment later.`,
    confirm: "Register equipment",
  },
  ticket: {
    icon: Ticket,
    title: (name) => `Create a service ticket for ${name}?`,
    description: (name) =>
      `${name} is registered. Open a ticket next — the customer and equipment will already be filled in. You can skip and stay on this page.`,
    confirm: "Create ticket",
  },
};

export function GuidedNextStepDialog({
  open,
  step,
  subjectName,
  onConfirm,
  onSkip,
}: GuidedNextStepDialogProps) {
  const copy = COPY[step];
  const Icon = copy.icon;
  const confirmedRef = useRef(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          confirmedRef.current = false;
          return;
        }
        if (confirmedRef.current) return;
        onSkip();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {copy.title(subjectName)}
          </AlertDialogTitle>
          <AlertDialogDescription>{copy.description(subjectName)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              confirmedRef.current = true;
              onConfirm();
            }}
          >
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
