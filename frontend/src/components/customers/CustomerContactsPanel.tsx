import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api, type BackendCustomerContact } from "@/lib/api";
import { toast } from "@/lib/toast";

export function CustomerContactsPanel({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const [contacts, setContacts] = useState<BackendCustomerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    void api.listCustomerContacts(customerId)
      .then(setContacts)
      .catch((error) => toast.apiError(error, { fallback: "Unable to load contacts" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [customerId]);

  const add = async () => {
    if (!name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    setSaving(true);
    try {
      await api.createCustomerContact(customerId, { name, role, email, phone, isPrimary });
      setName("");
      setRole("");
      setEmail("");
      setPhone("");
      setIsPrimary(false);
      toast.success("Contact added");
      load();
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to add contact" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (contactId: string) => {
    try {
      await api.deleteCustomerContact(customerId, contactId);
      load();
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to delete contact" });
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
        </p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No additional contacts yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {contact.name}
                  {contact.isPrimary ? <span className="ml-2 text-xs text-muted-foreground">Primary</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[contact.role, contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {canEdit ? (
                <Button size="icon" variant="ghost" onClick={() => void remove(contact.id)} aria-label="Delete contact">
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {canEdit ? (
        <div className="grid gap-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Accounts, Biomedical, …" />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isPrimary} onCheckedChange={(checked) => setIsPrimary(checked === true)} />
            Primary contact
          </label>
          <Button size="sm" onClick={() => void add()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add contact
          </Button>
        </div>
      ) : null}
    </div>
  );
}
