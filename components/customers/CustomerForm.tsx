"use client";
import { useState } from "react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CustomerFormProps {
  onClose: () => void;
  onCreated?: () => void;
}

export function CustomerForm({ onClose, onCreated }: CustomerFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationalId: "",
    dateOfBirth: "",
    monthlyIncome: "",
    occupation: "",
    employer: "",
    address: "",
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          monthlyIncome: Number(form.monthlyIncome),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save customer.");
        return;
      }
      onCreated?.();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input label="First Name" placeholder="Marie" required value={form.firstName} onChange={set("firstName")} />
        <Input label="Last Name" placeholder="Uwase" required value={form.lastName} onChange={set("lastName")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Email" type="email" placeholder="marie@example.com" value={form.email} onChange={set("email")} />
        <Input label="Phone" placeholder="+250788000000" required value={form.phone} onChange={set("phone")} />
      </div>
      <Input label="National ID" placeholder="1199080000001118" required value={form.nationalId} onChange={set("nationalId")} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date of Birth" type="date" required value={form.dateOfBirth} onChange={set("dateOfBirth")} />
        <Input label="Monthly Income (RWF)" type="number" placeholder="450000" required value={form.monthlyIncome} onChange={set("monthlyIncome")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Occupation" placeholder="Trader" required value={form.occupation} onChange={set("occupation")} />
        <Input label="Employer" placeholder="Self-employed" value={form.employer} onChange={set("employer")} />
      </div>
      <Textarea label="Address" placeholder="Nyarugenge, Kigali, Rwanda" required value={form.address} onChange={set("address")} />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Customer</Button>
      </div>
    </form>
  );
}
