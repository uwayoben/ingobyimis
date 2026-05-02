"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { User, MapPin, Phone, Briefcase, Heart, Building2 } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

const PROVINCES = ["Kigali", "Eastern", "Western", "Northern", "Southern"];
const GENDERS = ["Male", "Female"];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];
const EMPLOYMENT_STATUSES = ["Employed", "Self-employed", "Unemployed", "Retired"];
const PROPERTY_REGIMES = ["Community of Property", "Separation of Property", "Participation in Acquisitions"];
const NDFSP_RELATIONSHIPS = ["Client", "Employee", "Partner", "Board Member", "Shareholder", "Other"];

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
      <div className="w-6 h-6 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
        {icon}
      </div>
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{title}</p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all";

export function CustomerForm({ onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    names: "", nationalId: "", dateOfBirth: "", gender: "",
    province: "", district: "", sector: "", cell: "", village: "",
    phone: "", email: "",
    maritalStatus: "", maritalPropertyRegime: "",
    spouseName: "", spousePhone: "", spouseIdNumber: "",
    employmentStatus: "", employerName: "",
    relationshipWithNdfsp: "",
  });

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const isMarried = form.maritalStatus === "Married";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = { ...form };
      if (!isMarried) {
        payload.spouseName = "";
        payload.spousePhone = "";
        payload.spouseIdNumber = "";
        payload.maritalPropertyRegime = "";
      }
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to save customer."); return; }
      onCreated?.();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Personal Details ── */}
      <div className="space-y-4">
        <SectionHeader icon={<User className="w-3.5 h-3.5" />} title="Personal Details" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Names" required>
            <input className={inputCls} placeholder="Marie Uwase" required value={form.names} onChange={set("names")} />
          </Field>
          <Field label="National ID" required>
            <input className={inputCls} placeholder="1199080000001118" required value={form.nationalId} onChange={set("nationalId")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date of Birth" required>
            <input type="date" className={inputCls} required value={form.dateOfBirth} onChange={set("dateOfBirth")} />
          </Field>
          <Field label="Gender" required>
            <select className={inputCls} required value={form.gender} onChange={set("gender")}>
              <option value="">Select gender</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* ── Location ── */}
      <div className="space-y-4">
        <SectionHeader icon={<MapPin className="w-3.5 h-3.5" />} title="Location (Rwanda)" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Province" required>
            <select className={inputCls} required value={form.province} onChange={set("province")}>
              <option value="">Select province</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="District" required>
            <input className={inputCls} placeholder="Nyarugenge" required value={form.district} onChange={set("district")} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sector" required>
            <input className={inputCls} placeholder="Nyarugenge" required value={form.sector} onChange={set("sector")} />
          </Field>
          <Field label="Cell" required>
            <input className={inputCls} placeholder="Biryogo" required value={form.cell} onChange={set("cell")} />
          </Field>
          <Field label="Village" required>
            <input className={inputCls} placeholder="Nyamirama" required value={form.village} onChange={set("village")} />
          </Field>
        </div>
      </div>

      {/* ── Contact ── */}
      <div className="space-y-4">
        <SectionHeader icon={<Phone className="w-3.5 h-3.5" />} title="Contact Information" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" required>
            <input className={inputCls} placeholder="+250788000000" required value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} placeholder="marie@example.com" value={form.email} onChange={set("email")} />
          </Field>
        </div>
      </div>

      {/* ── Employment ── */}
      <div className="space-y-4">
        <SectionHeader icon={<Briefcase className="w-3.5 h-3.5" />} title="Employment" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employment Status" required>
            <select className={inputCls} required value={form.employmentStatus} onChange={set("employmentStatus")}>
              <option value="">Select status</option>
              {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Employer Name">
            <input className={inputCls} placeholder="RSSB, Self-employed…" value={form.employerName} onChange={set("employerName")} />
          </Field>
        </div>
      </div>

      {/* ── Marital Information ── */}
      <div className="space-y-4">
        <SectionHeader icon={<Heart className="w-3.5 h-3.5" />} title="Marital Information" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marital Status" required>
            <select className={inputCls} required value={form.maritalStatus} onChange={set("maritalStatus")}>
              <option value="">Select status</option>
              {MARITAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {isMarried && (
            <Field label="Property Regime">
              <select className={inputCls} value={form.maritalPropertyRegime} onChange={set("maritalPropertyRegime")}>
                <option value="">Select regime</option>
                {PROPERTY_REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          )}
        </div>
        {isMarried && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-pink-50/50 dark:bg-pink-900/10 rounded-xl border border-pink-100 dark:border-pink-900/30">
            <Field label="Spouse Name">
              <input className={inputCls} placeholder="Full name" value={form.spouseName} onChange={set("spouseName")} />
            </Field>
            <Field label="Spouse Phone">
              <input className={inputCls} placeholder="+250788000000" value={form.spousePhone} onChange={set("spousePhone")} />
            </Field>
            <Field label="Spouse National ID">
              <input className={inputCls} placeholder="1199080000001118" value={form.spouseIdNumber} onChange={set("spouseIdNumber")} />
            </Field>
          </div>
        )}
      </div>

      {/* ── Institution ── */}
      <div className="space-y-4">
        <SectionHeader icon={<Building2 className="w-3.5 h-3.5" />} title="Institution" />
        <Field label="Relationship with NDFSP">
          <select className={inputCls} value={form.relationshipWithNdfsp} onChange={set("relationshipWithNdfsp")}>
            <option value="">Select relationship</option>
            {NDFSP_RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white dark:bg-gray-900 py-3 -mx-6 px-6 border-t border-gray-100 dark:border-gray-800">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Customer</Button>
      </div>
    </form>
  );
}
