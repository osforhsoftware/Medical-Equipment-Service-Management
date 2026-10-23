import { CheckCircle2, PenLine, Shield } from "lucide-react";
import { SignaturePad } from "@/components/shared/SignaturePad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerAdditionalField } from "@/lib/customerFields";

export const INSPECTOR_SIGNATURE_LABEL = "Inspector Signature";
export const ADMIN_SIGNATURE_LABEL = "Admin Signature";

export const INSPECTION_SIGNATURE_LABELS = new Set([
  INSPECTOR_SIGNATURE_LABEL,
  ADMIN_SIGNATURE_LABEL,
]);

export function getSignatureFieldValue(
  fields: CustomerAdditionalField[] | undefined | null,
  label: string,
): string | null {
  const value = fields?.find((field) => field.label === label)?.value?.trim();
  return value?.startsWith("data:image") ? value : null;
}

export function upsertSignatureField(
  fields: CustomerAdditionalField[],
  label: string,
  dataUrl: string | null,
): CustomerAdditionalField[] {
  const without = fields.filter((field) => field.label !== label);
  if (!dataUrl) return without;
  return [...without, { label, value: dataUrl }];
}

interface InspectionSignaturePanelProps {
  inspectorName?: string;
  additionalFields: CustomerAdditionalField[];
  onChange?: (fields: CustomerAdditionalField[]) => void;
  readOnly?: boolean;
  /** When false, omit the panel heading (e.g. parent section already titles it). */
  showHeading?: boolean;
}

function SignaturePreview({
  dataUrl,
  emptyLabel,
  alt,
}: {
  dataUrl: string | null;
  emptyLabel: string;
  alt: string;
}) {
  if (!dataUrl) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <img
      src={dataUrl}
      alt={alt}
      className="h-24 w-full rounded-lg border border-border bg-white object-contain"
    />
  );
}

export function InspectionSignaturePanel({
  inspectorName = "",
  additionalFields,
  onChange,
  readOnly = false,
  showHeading = true,
}: InspectionSignaturePanelProps) {
  const inspectorSig = getSignatureFieldValue(additionalFields, INSPECTOR_SIGNATURE_LABEL);
  const approvalSig = getSignatureFieldValue(additionalFields, ADMIN_SIGNATURE_LABEL);

  if (readOnly && !inspectorSig && !approvalSig) return null;

  const setSignature = (label: string, dataUrl: string | null) => {
    onChange?.(upsertSignatureField(additionalFields, label, dataUrl));
  };

  return (
    <section className="space-y-4">
      {showHeading ? (
        <>
          <h2 className="section-title flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" />
            Inspection Signatures
          </h2>
          <p className="text-sm text-muted-foreground">
            Draw on screen or upload a signature image. Signatures are saved with the inspection report.
          </p>
        </>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Inspector Signature
              {inspectorSig ? <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" /> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readOnly ? (
              <SignaturePreview
                dataUrl={inspectorSig}
                emptyLabel="Not yet signed"
                alt="Inspector signature"
              />
            ) : (
              <SignaturePad
                value={inspectorSig}
                ariaLabel="inspector signature"
                onChange={(dataUrl) => setSignature(INSPECTOR_SIGNATURE_LABEL, dataUrl)}
              />
            )}
            {inspectorName ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{inspectorName}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Admin / Approval Signature
              {approvalSig ? <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" /> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readOnly ? (
              <SignaturePreview
                dataUrl={approvalSig}
                emptyLabel="Not yet approved"
                alt="Approval signature"
              />
            ) : (
              <SignaturePad
                value={approvalSig}
                ariaLabel="admin approval signature"
                onChange={(dataUrl) => setSignature(ADMIN_SIGNATURE_LABEL, dataUrl)}
              />
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">Admin / Coordinator</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
