import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SendEmailModalProps {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
}

export function SendEmailModal({ invoiceId, open, onClose }: SendEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("Converted GST Invoice — InvoiceBridge");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSend = async () => {
    if (!isValidEmail(recipientEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/invoices/${invoiceId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail, subject, message }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to send email");
      }

      toast.success("Invoice sent successfully!", {
        description: `Email delivered to ${recipientEmail}`,
      });
      onClose();
      setRecipientEmail("");
      setMessage("");
    } catch (err: any) {
      toast.error("Failed to send email", {
        description: err.message || "Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !sending) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Send Invoice by Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="recipient" className="text-sm font-medium mb-1.5 block">
              Recipient Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipient"
              type="email"
              placeholder="client@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              disabled={sending}
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="subject" className="text-sm font-medium mb-1.5 block">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div>
            <Label htmlFor="message" className="text-sm font-medium mb-1.5 block">
              Message <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Textarea
              id="message"
              placeholder="Please find the converted GST invoice attached."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={sending}
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
            The GST invoice PDF will be attached automatically.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !recipientEmail}
            className="gap-2"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-4 h-4" /> Send Email</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
