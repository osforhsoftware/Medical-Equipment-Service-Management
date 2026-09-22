import { useState } from "react";
import { CheckCircle2, PenLine, RotateCcw, Shield } from "lucide-react";
import { SignaturePad } from "@/components/shared/SignaturePad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SignatureEntry {
  name: string;
  dataUrl: string | null;
  capturedAt: string | null;
}

export interface InspectionSignatures {
  inspectorSignature: SignatureEntry;
  approvalSignature: SignatureEntry;
}

interface InspectionSignaturePanelProps {
  inspectorName?: string;
  signatures?: InspectionSignatures | null;
  onSave?: (signatures: InspectionSignatures) => void;
  readOnly?: boolean;
}

const emptyEntry = (name = ""): SignatureEntry => ({
  name,
  dataUrl: null,
  capturedAt: null,
});

export function InspectionSignaturePanel({
  inspectorName = "",
  signatures,
  onSave,
  readOnly = false,
}: InspectionSignaturePanelProps) {
  const [inspectorSig, setInspectorSig] = useState<string | null>(
    signatures?.inspectorSignature?.dataUrl ?? null,
  );
  const [approvalSig, setApprovalSig] = useState<string | null>(
    signatures?.approvalSignature?.dataUrl ?? null,
  );

  const saved = Boolean(signatures?.inspectorSignature?.capturedAt);

  const handleSave = () => {
    if (!onSave) return;
    const now = new Date().toISOString();
    onSave({
      inspectorSignature: {
        name: inspectorName,
        dataUrl: inspectorSig,
        capturedAt: inspectorSig ? now : null,
      },
      approvalSignature: {
        name: "Admin / Coordinator",
        dataUrl: approvalSig,
        capturedAt: approvalSig ? now : null,
      },
    });
  };

  if (readOnly && !saved) return null;

  return (
    <section className="space-y-4">
      <h2 className="section-title flex items-center gap-2">
        <PenLine className="h-4 w-4 text-primary" />
        Inspection Signatures
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Inspector Signature */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Inspector Signature
              {signatures?.inspectorSignature?.capturedAt && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readOnly ? (
              signatures?.inspectorSignature?.dataUrl ? (
                <img
                  src={signatures.inspectorSignature.dataUrl}
                  alt="Inspector signature"
                  className="h-24 w-full rounded-lg border border-border object-contain bg-white"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Not yet signed</p>
              )
            ) : (
              <SignaturePad onChange={setInspectorSig} />
            )}
            {signatures?.inspectorSignature?.name && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {signatures.inspectorSignature.name}
                {signatures.inspectorSignature.capturedAt &&
                  ` · ${new Date(signatures.inspectorSignature.capturedAt).toLocaleDateString()}`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Approval Signature */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Admin / Approval Signature
              {signatures?.approvalSignature?.capturedAt && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readOnly ? (
              signatures?.approvalSignature?.dataUrl ? (
                <img
                  src={signatures.approvalSignature.dataUrl}
                  alt="Approval signature"
                  className="h-24 w-full rounded-lg border border-border object-contain bg-white"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Not yet approved</p>
              )
            ) : (
              <SignaturePad onChange={setApprovalSig} />
            )}
            {signatures?.approvalSignature?.capturedAt && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Admin / Coordinator ·{" "}
                {new Date(signatures.approvalSignature.capturedAt).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!readOnly && onSave && (
        <div className="flex items-center gap-2 justify-end">
          <p
            className={cn(
              "text-xs",
              inspectorSig || approvalSig ? "text-muted-foreground" : "text-muted-foreground/50",
            )}
          >
            {inspectorSig && approvalSig
              ? "Both signatures ready"
              : inspectorSig
                ? "Inspector signed — awaiting approval signature"
                : "Draw signatures above to finalise the inspection"}
          </p>
          {(inspectorSig || approvalSig) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setInspectorSig(null);
                setApprovalSig(null);
              }}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!inspectorSig && !approvalSig}
            onClick={handleSave}
          >
            Save signatures
          </Button>
        </div>
      )}
    </section>
  );
}
