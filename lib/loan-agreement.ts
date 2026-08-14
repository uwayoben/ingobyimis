import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * Fills the Kinyarwanda loan agreement template (templates/loan-agreement-rw.docx)
 * with real loan/customer/company data and returns the generated .docx as a Buffer.
 *
 * The template's {tags} were typed by hand in Word, so they carry real-world
 * quirks — inconsistent casing/spacing and even typos (e.g. "sapuse name",
 * "company aanme"). Every variant found in the template is mapped below to
 * the same underlying value so docxtemplater can resolve all of them; it
 * throws listing any unresolved tag, which is why this list must stay exact.
 */

export interface AgreementData {
  company: { name: string; address: string };
  managingDirectorName: string;
  customer: {
    names: string;
    dateOfBirth: Date | string;
    nationalId: string;
    phone: string;
    email: string | null;
    cell: string;
    sector: string;
    district: string;
    province: string;
    spouseName: string | null;
    spouseIdNumber: string | null;
    spousePhone: string | null;
  };
  loan: {
    amount: number;
    processingFeeRate: number;
    totalProcessingFeeScheduled: number;
    annualInterestRate: number;
    totalInstallments: number;
    nextPaymentAmount: number;
    firstPaymentDate: Date | string | null;
    agreedMaturityDate: Date | string | null;
    disbursementDate: Date | string | null;
  };
  loanOfficerName: string;
}

function formatDateRW(d: Date | string | null | undefined): string {
  if (!d) return "……………………";
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function formatMoney(n: number | null | undefined): string {
  return Math.round(n ?? 0).toLocaleString();
}

function formatPercent(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2)) + "%";
}

export function generateLoanAgreementBuffer(data: AgreementData): Buffer {
  const templatePath = path.join(process.cwd(), "templates", "loan-agreement-rw.docx");
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const companyName    = data.company.name;
  const districtSector = `${data.customer.district}, ${data.customer.sector}`;

  doc.render({
    "company name ":          companyName,
    "company aanme ":         companyName,
    // The template has no space between "ya" and this tag ("ya{company name}"),
    // so the value needs a leading space to avoid "yaDEVELOPER". The tag's other
    // two occurrences already have a space on both sides in the template, so
    // this adds a harmless double space there rather than a run-together word.
    "company name":           " " + companyName,
    "COMPANY NAME":           companyName,
    "Company name":           companyName,
    "managing director ":     data.managingDirectorName,
    // Template text is "{customer name }wavutse …" with no space after the tag.
    "customer name ":         data.customer.names + " ",
    "date of birth":          formatDateRW(data.customer.dateOfBirth),
    "id number ":             data.customer.nationalId,
    "district,sector ":       districtSector,
    // Template text is "{phone number }Email:" with no space after the tag.
    "phone number ":          data.customer.phone + " ",
    "email ":                 data.customer.email ?? "—",
    "cell":                   data.customer.cell,
    "sector ":                data.customer.sector,
    "district":               data.customer.district,
    "province ":              data.customer.province,
    "sapuse name ":           data.customer.spouseName ?? "—",
    // Template text is "{pause national  id }Telefoni" with no space after the tag.
    "pause national  id ":    (data.customer.spouseIdNumber ?? "—") + " ",
    "spause phone ":          data.customer.spousePhone ?? "—",
    " principe amount":       formatMoney(data.loan.amount),
    "application  fee rate ": formatPercent(data.loan.processingFeeRate),
    "processing amount ":     formatMoney(data.loan.totalProcessingFeeScheduled),
    // Template text is "na{ loan interest rate }" with no space before the tag.
    " loan interest rate ":   " " + formatPercent(data.loan.annualInterestRate / 12),
    // Template text is "ibyiciro:{installment number }Amafaranga" — no space either side.
    "installment number ":    " " + String(data.loan.totalInstallments) + " ",
    // Template text is "{installment amount }Frws" with no space after the tag.
    "installment amount ":    formatMoney(data.loan.nextPaymentAmount) + " ",
    // Template text is "ni:{ first payment date }" with no space before the tag.
    " first payment date ":   " " + formatDateRW(data.loan.firstPaymentDate),
    // Template text is "ni:{maturity date}" with no space before the tag.
    "maturity date":          " " + formatDateRW(data.loan.agreedMaturityDate),
    "taba vision ":           "Taba Vision",
    "company address":        data.company.address,
    "disbursement date":      formatDateRW(data.loan.disbursementDate),
    "loan officer":           data.loanOfficerName,
    "national id":            data.customer.nationalId,
    "phone":                  data.customer.phone,
  });

  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
