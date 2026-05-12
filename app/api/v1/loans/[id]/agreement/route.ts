import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

function fmt(n: number) {
  return n.toLocaleString("en-RW");
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "_______________";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function blank(val: string | null | undefined, fallback = "___________________________") {
  return val?.trim() || fallback;
}

function frequencyLabel(days: number): string {
  if (days === 1)  return "Daily";
  if (days === 7)  return "Weekly";
  if (days === 14) return "Bi-weekly";
  if (days === 30) return "Monthly";
  return `Every ${days} days`;
}

function periodLabel(days: number, count: number): string {
  if (days === 30)  return `${count} month${count !== 1 ? "s" : ""}`;
  if (days === 7)   return `${count} week${count !== 1 ? "s" : ""}`;
  if (days === 14)  return `${count} bi-week${count !== 1 ? "s" : ""}`;
  if (days === 1)   return `${count} day${count !== 1 ? "s" : ""}`;
  return `${count} installments`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(request);
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const loan = await prisma.loan.findFirst({
    where: { id, companyId: auth.companyId! },
    include: {
      customer:     true,
      fees:         true,
      installments: { orderBy: { installmentNo: "asc" }, take: 1 },
      loanOfficer:  { select: { name: true } },
      company:      true,
    },
  });

  if (!loan) return new Response("Loan not found", { status: 404 });

  const md = await prisma.user.findFirst({
    where: { companyId: loan.companyId!, role: "managing_director" },
    select: { name: true },
  });

  const company       = loan.company;
  const customer      = loan.customer;
  const monthlyRate   = Number(loan.annualInterestRate) / 12;
  const annualRate    = Number(loan.annualInterestRate);

  const processingFee = loan.fees.find(
    (f) => f.name.toLowerCase().includes("process") || f.name.toLowerCase().includes("admin")
  );
  const processingFeeText = processingFee
    ? processingFee.type === "percentage"
      ? `${Number(processingFee.value)}%`
      : `RWF ${fmt(Number(processingFee.value))}`
    : "N/A";

  const installmentAmt = loan.totalRepayable > 0 && loan.totalInstallments > 0
    ? Math.round(loan.totalRepayable / loan.totalInstallments)
    : (loan.installments[0]?.totalDue ?? 0);

  const customerAddress = [customer.cell, customer.sector, customer.district, customer.province]
    .filter(Boolean).join(", ");

  const refNo    = loan.id.slice(-10).toUpperCase();
  const createdStr = fmtDate(loan.createdAt);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Loan Agreement – ${customer.names}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 18mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --green:      #14532d;
    --green-mid:  #166534;
    --green-lite: #dcfce7;
    --green-rule: #16a34a;
    --gold:       #92400e;
    --gold-lite:  #fef3c7;
    --ink:        #1a1a1a;
    --muted:      #555;
    --light:      #f0fdf4;
    --rule:       #d1d5db;
  }

  body {
    font-family: "Source Serif 4", Georgia, serif;
    font-size: 10.5pt;
    line-height: 1.7;
    color: var(--ink);
    background: #fff;
  }

  /* ── Print bar ── */
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 200;
    background: var(--green); color: #fff;
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 28px; gap: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,.25);
  }
  .print-bar .pb-left { font-family: "Inter", sans-serif; font-size: 13px; font-weight: 600; }
  .print-bar .pb-ref  { font-family: "Inter", sans-serif; font-size: 11px; opacity: .7; }
  .print-bar button {
    font-family: "Inter", sans-serif; font-size: 13px; font-weight: 700;
    background: #fff; color: var(--green-mid); border: none;
    border-radius: 8px; padding: 7px 24px; cursor: pointer; transition: background .15s;
  }
  .print-bar button:hover { background: var(--green-lite); }
  @media print { .print-bar { display: none !important; } body { padding-top: 0 !important; } }
  body { padding-top: 52px; }
  @media print { body { padding-top: 0; } }

  /* ── Page wrapper ── */
  .page { max-width: 178mm; margin: 0 auto; padding: 8mm 0 12mm; }

  /* ── Letterhead ── */
  .letterhead {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding-bottom: 12pt; border-bottom: 3px solid var(--green);
    margin-bottom: 4pt;
  }
  .lh-logo {
    width: 48pt; height: 48pt; border-radius: 8pt;
    background: var(--green); display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: "Playfair Display", serif; font-size: 20pt; font-weight: 700;
    flex-shrink: 0; letter-spacing: -1px;
  }
  .lh-company { flex: 1; padding-left: 12pt; }
  .lh-company .name {
    font-family: "Playfair Display", serif;
    font-size: 15pt; font-weight: 700; color: var(--green);
    line-height: 1.2; letter-spacing: .3px;
  }
  .lh-company .tagline {
    font-family: "Inter", sans-serif;
    font-size: 8pt; color: var(--muted); margin-top: 2pt; letter-spacing: .4px;
    text-transform: uppercase;
  }
  .lh-company .contact {
    font-family: "Inter", sans-serif;
    font-size: 8.5pt; color: var(--muted); margin-top: 5pt; line-height: 1.5;
  }
  .lh-meta {
    text-align: right; font-family: "Inter", sans-serif; font-size: 8.5pt; color: var(--muted);
    border-left: 2px solid var(--green-lite); padding-left: 12pt; min-width: 90pt;
  }
  .lh-meta .meta-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5px; color: #999; }
  .lh-meta .meta-val   { font-weight: 600; color: var(--ink); margin-bottom: 4pt; font-size: 9pt; }

  /* ── Document title banner ── */
  .doc-title-wrap { margin: 14pt 0 10pt; text-align: center; }
  .doc-title {
    display: inline-block;
    font-family: "Playfair Display", serif;
    font-size: 17pt; font-weight: 700; color: var(--green);
    letter-spacing: 2px; text-transform: uppercase;
    border-top: 1px solid var(--green-rule);
    border-bottom: 1px solid var(--green-rule);
    padding: 5pt 32pt;
  }
  .doc-subtitle {
    font-family: "Inter", sans-serif; font-size: 8pt;
    color: var(--muted); margin-top: 4pt; letter-spacing: .8px; text-transform: uppercase;
  }

  /* ── Key terms box ── */
  .terms-box {
    background: var(--light);
    border: 1.5px solid #bbf7d0;
    border-left: 5px solid var(--green-rule);
    border-radius: 6pt;
    padding: 12pt 14pt; margin: 12pt 0;
  }
  .terms-box .tb-title {
    font-family: "Inter", sans-serif; font-size: 8pt; font-weight: 600;
    text-transform: uppercase; letter-spacing: .8px; color: var(--green-mid); margin-bottom: 8pt;
  }
  .terms-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt 12pt;
  }
  .tg-item .tg-label {
    font-family: "Inter", sans-serif; font-size: 7.5pt; color: var(--muted);
    text-transform: uppercase; letter-spacing: .4px;
  }
  .tg-item .tg-val {
    font-family: "Inter", sans-serif; font-size: 10.5pt; font-weight: 600; color: var(--green);
    line-height: 1.3; margin-top: 1pt;
  }
  .tg-item .tg-sub {
    font-size: 8pt; color: var(--muted); margin-top: 1pt;
  }

  /* ── Parties ── */
  .parties { margin: 10pt 0; }
  .parties p { margin-bottom: 6pt; text-align: justify; }
  .parties .and-divider {
    text-align: center; font-family: "Inter", sans-serif; font-size: 9pt;
    font-weight: 600; letter-spacing: 2px; color: var(--muted);
    margin: 8pt 0; display: flex; align-items: center; gap: 10pt;
  }
  .and-divider::before, .and-divider::after {
    content: ""; flex: 1; height: 1px; background: var(--rule);
  }
  .it-agreed {
    text-align: center; font-family: "Playfair Display", serif;
    font-size: 11pt; font-style: italic; color: var(--muted); margin: 10pt 0 6pt;
  }

  /* ── Articles ── */
  .article { margin: 12pt 0; page-break-inside: avoid; }
  .article-header {
    display: flex; align-items: center; gap: 8pt; margin-bottom: 7pt;
  }
  .article-num {
    width: 20pt; height: 20pt; border-radius: 50%;
    background: var(--green); color: #fff;
    font-family: "Inter", sans-serif; font-size: 8pt; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .article-title {
    font-family: "Playfair Display", serif;
    font-size: 11.5pt; font-weight: 600; color: var(--green);
    border-bottom: 1px solid #bbf7d0; flex: 1; padding-bottom: 3pt;
  }
  .article p  { margin-bottom: 5pt; text-align: justify; }
  .article li { margin-bottom: 4pt; text-align: justify; }
  .article ul, .article ol { padding-left: 16pt; margin: 5pt 0 6pt; }
  .article ol[type="a"] li { text-align: justify; }

  /* Field rows */
  .field-row {
    display: flex; align-items: flex-end; gap: 6pt;
    margin-bottom: 5pt; font-size: 10pt;
  }
  .field-label { color: var(--muted); min-width: 175pt; flex-shrink: 0; }
  .field-value {
    border-bottom: 1px solid #aaa; flex: 1; padding-bottom: 1pt;
    font-weight: 500; color: var(--ink); min-height: 14pt;
  }

  .field-inline {
    border-bottom: 1px solid #aaa; display: inline-block;
    min-width: 100pt; padding-bottom: 1pt; color: var(--ink);
  }

  /* ── Dividers ── */
  .rule-heavy { border: none; border-top: 2px solid var(--green); margin: 14pt 0; }
  .rule-light { border: none; border-top: 1px solid var(--rule);  margin: 8pt 0; }

  /* ── Signature section ── */
  .sig-section { margin-top: 22pt; page-break-inside: avoid; }
  .sig-heading {
    text-align: center; font-family: "Playfair Display", serif;
    font-size: 12pt; font-weight: 600; color: var(--green); margin-bottom: 16pt;
  }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28pt; }
  .sig-box {
    border: 1.5px solid #d1fae5; border-top: 4px solid var(--green);
    border-radius: 0 0 6pt 6pt; padding: 12pt 14pt;
  }
  .sig-role {
    font-family: "Inter", sans-serif; font-size: 8pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px; color: var(--green); margin-bottom: 8pt;
  }
  .sig-name  { font-family: "Source Serif 4", serif; font-size: 10.5pt; margin-bottom: 4pt; }
  .sig-line  { border-bottom: 1.5px solid var(--ink); height: 28pt; margin: 10pt 0 4pt; }
  .sig-hint  { font-family: "Inter", sans-serif; font-size: 8pt; color: var(--muted); }
  .stamp-box {
    border: 1.5px dashed #aaa; border-radius: 6pt;
    width: 72pt; height: 72pt; margin-top: 10pt;
    display: flex; align-items: center; justify-content: center;
    color: #bbb; font-family: "Inter", sans-serif; font-size: 8pt; text-align: center;
    line-height: 1.4;
  }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 18pt; text-align: center;
    font-family: "Inter", sans-serif; font-size: 8pt; color: #aaa;
    border-top: 1px solid var(--rule); padding-top: 8pt;
  }
</style>
</head>
<body>

<!-- Print bar -->
<div class="print-bar">
  <div>
    <div class="pb-left">Loan Agreement — ${customer.names}</div>
    <div class="pb-ref">Ref: ${refNo} &nbsp;·&nbsp; ${createdStr}</div>
  </div>
  <button onclick="window.print()">🖨&nbsp; Print / Save PDF</button>
</div>

<div class="page">

  <!-- ── Letterhead ── -->
  <div class="letterhead">
    <div class="lh-logo">${(company?.name ?? "L")[0].toUpperCase()}</div>
    <div class="lh-company">
      <div class="name">${blank(company?.name, "LENDING COMPANY")}</div>
      <div class="tagline">Licensed Microfinance Institution &nbsp;·&nbsp; National Bank of Rwanda</div>
      <div class="contact">
        ${blank(company?.address)} &nbsp;|&nbsp; ${blank(company?.phone)} &nbsp;|&nbsp; ${blank(company?.email)}
      </div>
    </div>
    <div class="lh-meta">
      <div class="meta-label">Reference No.</div>
      <div class="meta-val">${refNo}</div>
      <div class="meta-label">Date Issued</div>
      <div class="meta-val">${createdStr}</div>
    </div>
  </div>

  <!-- ── Title ── -->
  <div class="doc-title-wrap">
    <div class="doc-title">Loan Agreement</div>
    <div class="doc-subtitle">This Agreement is legally binding under the laws of the Republic of Rwanda</div>
  </div>

  <!-- ── Key Terms Highlight ── -->
  <div class="terms-box">
    <div class="tb-title">Loan Summary</div>
    <div class="terms-grid">
      <div class="tg-item">
        <div class="tg-label">Loan Amount</div>
        <div class="tg-val">RWF ${fmt(loan.disbursedAmount > 0 ? loan.disbursedAmount : loan.amount)}</div>
        <div class="tg-sub">${loan.interestMethod === "flat" ? "Flat" : "Declining"} balance</div>
      </div>
      <div class="tg-item">
        <div class="tg-label">Total Repayable</div>
        <div class="tg-val">RWF ${fmt(loan.totalRepayable)}</div>
        <div class="tg-sub">Principal + Interest</div>
      </div>
      <div class="tg-item">
        <div class="tg-label">${frequencyLabel(loan.repaymentFrequencyDays)} Installment</div>
        <div class="tg-val">RWF ${fmt(installmentAmt)}</div>
        <div class="tg-sub">${loan.totalInstallments} installments</div>
      </div>
      <div class="tg-item">
        <div class="tg-label">Interest Rate</div>
        <div class="tg-val">${annualRate.toFixed(2)}% p.a.</div>
        <div class="tg-sub">${monthlyRate.toFixed(2)}% per month</div>
      </div>
      <div class="tg-item">
        <div class="tg-label">First Payment</div>
        <div class="tg-val" style="font-size:9pt;">${fmtDate(loan.firstPaymentDate)}</div>
        <div class="tg-sub">${frequencyLabel(loan.repaymentFrequencyDays)}</div>
      </div>
      <div class="tg-item">
        <div class="tg-label">Maturity Date</div>
        <div class="tg-val" style="font-size:9pt;">${fmtDate(loan.agreedMaturityDate)}</div>
        <div class="tg-sub">${periodLabel(loan.repaymentFrequencyDays, loan.totalInstallments)}</div>
      </div>
    </div>
  </div>

  <hr class="rule-light"/>

  <!-- ── Parties ── -->
  <div class="parties">
    <p>
      <strong>${blank(company?.name, "[LENDER]")}</strong>, a licensed lending institution duly authorized by the
      National Bank of Rwanda (BNR), with registered offices at <span class="field-inline">${blank(company?.address)}</span>,
      represented by <span class="field-inline">${blank(md?.name)}</span>,
      hereinafter referred to as <strong>"the Lender"</strong>;
    </p>
    <div class="and-divider">AND</div>
    <p>
      <strong>${blank(customer.names)}</strong>,
      National ID: <span class="field-inline">${blank(customer.nationalId)}</span>,
      Tel: <span class="field-inline">${blank(customer.phone)}</span>,
      Address: <span class="field-inline">${blank(customerAddress)}</span>,
      hereinafter referred to as <strong>"the Borrower"</strong>.
    </p>
    <p class="it-agreed">— It is hereby agreed as follows —</p>
  </div>

  <hr class="rule-light"/>

  <!-- ARTICLE 1 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">1</div>
      <div class="article-title">Definitions</div>
    </div>
    <p><strong>"Lender"</strong> means the licensed institution named above. <strong>"Borrower"</strong> means the individual named above. <strong>"Agreement"</strong> means this Loan Agreement in its entirety.</p>
  </div>

  <!-- ARTICLE 2 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">2</div>
      <div class="article-title">Purpose of the Loan</div>
    </div>
    <div class="field-row"><span class="field-label">Loan Amount:</span><span class="field-value">RWF ${fmt(loan.disbursedAmount > 0 ? loan.disbursedAmount : loan.amount)}</span></div>
    <div class="field-row"><span class="field-label">Purpose of Loan:</span><span class="field-value">${blank(loan.purpose)}</span></div>
    <div class="field-row"><span class="field-label">Outstanding Balance (prior, if any):</span><span class="field-value">${loan.balanceOutstanding > 0 && loan.installmentsPaid > 0 ? "RWF " + fmt(loan.balanceOutstanding) : "None"}</span></div>
  </div>

  <!-- ARTICLE 3 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">3</div>
      <div class="article-title">Interest Rate and Charges</div>
    </div>
    <p>
      The loan bears interest at <strong>${monthlyRate.toFixed(2)}% per month</strong>
      (<strong>${annualRate.toFixed(2)}% per annum</strong>),
      calculated on a <strong>${loan.interestMethod === "flat" ? "flat" : "declining"} balance</strong> basis.
      A loan processing fee of <strong>${processingFeeText}</strong> is payable upon disbursement.
    </p>
    <p>Late payment consequences:</p>
    <ul>
      <li>Interest continues to accrue on the outstanding balance.</li>
      <li>A late payment penalty per the Lender's prevailing policy shall apply.</li>
      <li>Loan management and recovery costs shall be borne by the Borrower.</li>
    </ul>
  </div>

  <!-- ARTICLE 4 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">4</div>
      <div class="article-title">Repayment Terms</div>
    </div>
    <div class="field-row"><span class="field-label">Total Amount Repayable:</span><span class="field-value">RWF ${fmt(loan.totalRepayable)}</span></div>
    <div class="field-row"><span class="field-label">Repayment Period:</span><span class="field-value">${periodLabel(loan.repaymentFrequencyDays, loan.totalInstallments)} — ${frequencyLabel(loan.repaymentFrequencyDays)}</span></div>
    <div class="field-row"><span class="field-label">Installment Amount:</span><span class="field-value">RWF ${fmt(installmentAmt)}</span></div>
    <div class="field-row"><span class="field-label">First Payment Date:</span><span class="field-value">${fmtDate(loan.firstPaymentDate)}</span></div>
    <div class="field-row"><span class="field-label">Agreed Maturity Date:</span><span class="field-value">${fmtDate(loan.agreedMaturityDate)}</span></div>
    <br/>
    <p>Payments shall be remitted to:</p>
    <div class="field-row"><span class="field-label">Account Name:</span><span class="field-value">${blank(company?.name)}</span></div>
    <div class="field-row"><span class="field-label">Account Number:</span><span class="field-value"></span></div>
    <div class="field-row"><span class="field-label">Bank / MNO:</span><span class="field-value"></span></div>
    <br/>
    <p>Prepayment is permitted subject to accrued interest for the current period.
    A delay exceeding <strong>${loan.gracePeriodDays > 0 ? loan.gracePeriodDays : 30} days</strong> may result in penalties, debt recovery, or legal action.</p>
  </div>

  <!-- ARTICLE 5 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">5</div>
      <div class="article-title">Events of Default and Termination</div>
    </div>
    <p>The Lender may declare the full outstanding balance immediately due and payable upon any of the following:</p>
    <ol type="a">
      <li>Loan proceeds used for purposes other than stated;</li>
      <li>Payment delay exceeding the agreed grace period;</li>
      <li>Material misrepresentation by the Borrower;</li>
      <li>Deterioration or disposal of collateral without written consent;</li>
      <li>Insolvency, bankruptcy, or legal proceedings against the Borrower.</li>
    </ol>
  </div>

  <!-- ARTICLE 6 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">6</div>
      <div class="article-title">Security / Collateral</div>
    </div>
    <div class="field-row"><span class="field-label">Type of Collateral:</span><span class="field-value">${blank(loan.collateralType)}</span></div>
    <div class="field-row"><span class="field-label">Estimated Value:</span><span class="field-value">${loan.collateralAmount ? "RWF " + fmt(loan.collateralAmount) : ""}</span></div>
    <div class="field-row"><span class="field-label">Eligible Collateral Amount:</span><span class="field-value">${loan.eligibleCollateral ? "RWF " + fmt(loan.eligibleCollateral) : ""}</span></div>
    <div class="field-row"><span class="field-label">Description / Location:</span><span class="field-value"></span></div>
    <br/>
    <p>In the event of default, the Lender reserves the right to seize and liquidate the collateral to recover outstanding amounts.
    The Borrower undertakes to preserve the collateral's value and shall not encumber, sell, or modify it without prior written consent.</p>
  </div>

  <!-- ARTICLE 7 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">7</div>
      <div class="article-title">Credit Information</div>
    </div>
    <p>The Borrower authorizes the Lender to submit loan performance data to <strong>Credit Reference Bureau Africa Ltd</strong>
    and other BNR-approved credit bureaus. The Borrower retains the right to access and rectify their credit record.</p>
  </div>

  <!-- ARTICLE 8 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">8</div>
      <div class="article-title">Costs and Expenses</div>
    </div>
    <p>All costs relating to the preparation, execution, and enforcement of this Agreement — including legal fees, stamp duty, and recovery costs — shall be borne entirely by the Borrower.</p>
  </div>

  <!-- ARTICLE 9 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">9</div>
      <div class="article-title">Notices and Communication</div>
    </div>
    <p>All official notices shall be delivered to the addresses stated above. The Borrower must promptly notify the Lender in writing of any change in contact details.</p>
  </div>

  <!-- ARTICLE 10 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">10</div>
      <div class="article-title">Governing Law and Dispute Resolution</div>
    </div>
    <p>This Agreement is governed by the laws of the Republic of Rwanda. The parties shall first attempt amicable settlement. If unresolved within 30 days, disputes shall be submitted to the competent courts of Rwanda.</p>
  </div>

  <!-- ARTICLE 11 -->
  <div class="article">
    <div class="article-header">
      <div class="article-num">11</div>
      <div class="article-title">Declaration and Acceptance</div>
    </div>
    <p>Both parties confirm that they have read, understood, and freely consent to all terms and conditions of this Agreement. This Agreement shall come into force upon execution by both parties.</p>
    <br/>
    <p>Done at: <span class="field-inline">${blank(company?.address?.split(",")[0])}</span></p>
    <p>Date: <span class="field-inline" style="min-width:30pt;">&nbsp;&nbsp;&nbsp;</span> /
           <span class="field-inline" style="min-width:30pt;">&nbsp;&nbsp;&nbsp;</span> /
           <span class="field-inline" style="min-width:54pt;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
  </div>

  <hr class="rule-heavy"/>

  <!-- ── Signatures ── -->
  <div class="sig-section">
    <div class="sig-heading">Execution of Agreement</div>
    <div class="sig-grid">
      <div class="sig-box">
        <div class="sig-role">Borrower</div>
        <div class="sig-name"><strong>${blank(customer.names)}</strong></div>
        <p style="font-size:9pt; color:var(--muted);">National ID: ${blank(customer.nationalId)}</p>
        <p style="font-size:9pt; color:var(--muted);">Tel: ${blank(customer.phone)}</p>
        <div class="sig-line"></div>
        <div class="sig-hint">Signature &amp; Date</div>
        <div class="stamp-box">Fingerprint /<br/>Stamp</div>
      </div>
      <div class="sig-box">
        <div class="sig-role">Lender — Authorized Representative</div>
        <div class="sig-name"><strong>${blank(company?.name)}</strong></div>
        <p style="font-size:9pt; color:var(--muted);">Represented by: ${blank(md?.name)}</p>
        <p style="font-size:9pt; color:var(--muted);">Title: Managing Director</p>
        <div class="sig-line"></div>
        <div class="sig-hint">Signature &amp; Date</div>
        <div class="stamp-box">Official<br/>Company Stamp</div>
      </div>
    </div>
  </div>

  <!-- ── Footer ── -->
  <div class="doc-footer">
    Ref: ${refNo} &nbsp;·&nbsp; ${blank(company?.name)} &nbsp;·&nbsp; Generated ${createdStr} &nbsp;·&nbsp;
    Regulated by the National Bank of Rwanda (BNR)
  </div>

</div><!-- /page -->
<script>window.onload = () => { if (document.referrer.includes("/api/v1/")) window.print(); };</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
