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
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const loan = await prisma.loan.findFirst({
    where: { id, companyId: auth.companyId! },
    include: {
      customer:    true,
      fees:        true,
      installments: { orderBy: { installmentNo: "asc" }, take: 1 },
      loanOfficer: { select: { name: true } },
      company:     true,
    },
  });

  if (!loan) {
    return new Response("Loan not found", { status: 404 });
  }

  const md = await prisma.user.findFirst({
    where: { companyId: loan.companyId!, role: "managing_director" },
    select: { name: true },
  });

  const company   = loan.company;
  const customer  = loan.customer;
  const monthlyRate = Number(loan.annualInterestRate) / 12;

  const processingFee = loan.fees.find(
    (f) => f.name.toLowerCase().includes("process") || f.name.toLowerCase().includes("admin")
  );
  const processingFeeText = processingFee
    ? processingFee.type === "percentage"
      ? `${Number(processingFee.value)}%`
      : `RWF ${fmt(Number(processingFee.value))}`
    : "_______________";

  const installmentAmt = loan.totalRepayable > 0 && loan.totalInstallments > 0
    ? Math.round(loan.totalRepayable / loan.totalInstallments)
    : (loan.installments[0]?.totalDue ?? 0);

  const customerAddress = [customer.cell, customer.sector, customer.district, customer.province]
    .filter(Boolean)
    .join(", ");

  const todayStr = fmtDate(new Date());
  const createdStr = fmtDate(loan.createdAt);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Loan Agreement – ${customer.names}</title>
<style>
  @page { size: A4; margin: 20mm 18mm 20mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #111;
    background: #fff;
  }
  .page { max-width: 170mm; margin: 0 auto; padding: 10mm 0; }

  /* Print button – hidden when printing */
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0;
    background: #166534; color: #fff;
    padding: 10px 24px;
    display: flex; align-items: center; justify-between;
    gap: 12px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.2);
  }
  .print-bar span { font-family: sans-serif; font-size: 13px; font-weight: 600; }
  .print-bar button {
    font-family: sans-serif; font-size: 13px; font-weight: 700;
    background: #fff; color: #166534;
    border: none; border-radius: 6px;
    padding: 7px 22px; cursor: pointer;
  }
  .print-bar button:hover { background: #dcfce7; }
  @media print { .print-bar { display: none !important; } body { padding-top: 0 !important; } }

  body { padding-top: 50px; }
  @media print { body { padding-top: 0; } }

  /* Document */
  .doc-header { text-align: center; margin-bottom: 18pt; }
  .doc-header h1 { font-size: 15pt; font-weight: bold; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 4pt; }
  .doc-header .ref { font-size: 10pt; color: #444; }
  hr.thick { border: none; border-top: 2px solid #111; margin: 10pt 0; }
  hr.thin  { border: none; border-top: 1px solid #888; margin: 8pt 0; }

  .parties { margin-bottom: 14pt; }
  .parties p { margin-bottom: 6pt; text-align: justify; }

  .article { margin-bottom: 14pt; page-break-inside: avoid; }
  .article-title { font-weight: bold; font-size: 11pt; text-transform: uppercase; margin-bottom: 6pt; }
  .article p, .article li { margin-bottom: 5pt; text-align: justify; }
  .article ul, .article ol { padding-left: 18pt; margin-bottom: 6pt; }
  .article .row { display: flex; gap: 6pt; margin-bottom: 4pt; }
  .article .lbl { min-width: 200pt; font-weight: normal; }
  .article .val { border-bottom: 1px solid #555; flex: 1; padding-bottom: 1pt; }

  .sig-section { margin-top: 28pt; page-break-inside: avoid; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24pt; margin-top: 14pt; }
  .sig-box { border-top: 2px solid #111; padding-top: 8pt; }
  .sig-box p { margin-bottom: 6pt; }
  .sig-line { border-bottom: 1px solid #555; height: 22pt; margin-bottom: 6pt; }

  .stamp-area {
    border: 2px dashed #ccc; border-radius: 6pt;
    width: 80pt; height: 80pt;
    display: flex; align-items: center; justify-content: center;
    color: #aaa; font-size: 9pt; text-align: center;
    margin-top: 8pt;
  }

  .field { border-bottom: 1px solid #555; display: inline-block; min-width: 120pt; padding-bottom: 1pt; }
</style>
</head>
<body>
<div class="print-bar">
  <span>Loan Agreement — ${customer.names}</span>
  <button onclick="window.print()">&#128438; Print / Save as PDF</button>
</div>

<div class="page">

  <div class="doc-header">
    <h1>Loan Agreement</h1>
    <div class="ref">Reference No: <strong>${loan.id.slice(-8).toUpperCase()}</strong> &nbsp;|&nbsp; Date: <strong>${createdStr}</strong></div>
  </div>
  <hr class="thick" />

  <div class="parties">
    <p>
      <strong>${blank(company?.name, "[LENDER COMPANY NAME]")}</strong>, a licensed lending institution approved by the National Bank
      of Rwanda (BNR), headquartered at <span class="field">${blank(company?.address)}</span>,
      Tel: <span class="field">${blank(company?.phone)}</span>,
      represented by <span class="field">${blank(md?.name)}</span>,
      hereinafter referred to as <strong>"the Lender"</strong>, on one part;
    </p>
    <p style="text-align:center; font-weight:bold; margin: 8pt 0;">AND</p>
    <p>
      <strong>${blank(customer.names)}</strong>,<br/>
      ID/Registration No: <span class="field">${blank(customer.nationalId)}</span><br/>
      Tel: <span class="field">${blank(customer.phone)}</span><br/>
      Email: <span class="field">${blank(customer.email)}</span><br/>
      Address: <span class="field">${blank(customerAddress)}</span>
    </p>
    <p>Hereinafter referred to as <strong>"the Borrower"</strong>, on the other part;</p>
  </div>

  <p style="text-align:center; font-weight:bold; margin: 10pt 0;">IT IS HEREBY AGREED AS FOLLOWS:</p>
  <hr class="thin" />

  <!-- ARTICLE 1 -->
  <div class="article">
    <div class="article-title">Article 1: Definitions</div>
    <p>1.1 <strong>"Lender"</strong> means the licensed lending company identified above.</p>
    <p>1.2 <strong>"Borrower"</strong> means the individual or company identified above.</p>
    <p>1.3 <strong>"Company"</strong> refers to the Lender throughout this Agreement.</p>
  </div>

  <!-- ARTICLE 2 -->
  <div class="article">
    <div class="article-title">Article 2: Purpose of the Loan</div>
    <p>The Lender grants the Borrower a loan in accordance with its internal policies and this Agreement.</p>
    <div class="row"><span class="lbl">Loan Amount:</span><span class="val">RWF ${fmt(loan.disbursedAmount > 0 ? loan.disbursedAmount : loan.amount)}</span></div>
    <div class="row"><span class="lbl">Purpose of Loan:</span><span class="val">${blank(loan.purpose)}</span></div>
    <div class="row"><span class="lbl">Previous Outstanding Balance (if any):</span><span class="val">${loan.balanceOutstanding > 0 && loan.installmentsPaid > 0 ? "RWF " + fmt(loan.balanceOutstanding) : "None"}</span></div>
  </div>

  <!-- ARTICLE 3 -->
  <div class="article">
    <div class="article-title">Article 3: Interest and Charges</div>
    <p>The loan carries an interest rate of <strong>${monthlyRate.toFixed(2)}%</strong> per month (<strong>${Number(loan.annualInterestRate).toFixed(2)}%</strong> per annum), calculated on a <strong>${loan.interestMethod === "flat" ? "flat" : "declining"} balance</strong> basis.</p>
    <p>In case of late payment:</p>
    <ul>
      <li>Interest will continue to accrue on the outstanding balance.</li>
      <li>Loan management and recovery fees may apply.</li>
      <li>A late payment penalty may be charged on overdue amounts per the Lender's policy.</li>
    </ul>
    <p>The Borrower shall also pay a loan processing fee of <strong>${processingFeeText}</strong> of the loan amount.</p>
  </div>

  <!-- ARTICLE 4 -->
  <div class="article">
    <div class="article-title">Article 4: Loan Term and Repayment</div>
    <div class="row"><span class="lbl">Total Repayment Amount:</span><span class="val">RWF ${fmt(loan.totalRepayable)}</span></div>
    <div class="row"><span class="lbl">Repayment Period:</span><span class="val">${periodLabel(loan.repaymentFrequencyDays, loan.totalInstallments)} (${frequencyLabel(loan.repaymentFrequencyDays)} installments)</span></div>
    <div class="row"><span class="lbl">Installment Amount:</span><span class="val">RWF ${fmt(installmentAmt)}</span></div>
    <div class="row"><span class="lbl">First Payment Date:</span><span class="val">${fmtDate(loan.firstPaymentDate)}</span></div>
    <div class="row"><span class="lbl">Agreed Maturity Date:</span><span class="val">${fmtDate(loan.agreedMaturityDate)}</span></div>
    <br/>
    <p>Payments shall be made to:</p>
    <div class="row"><span class="lbl">Account Name:</span><span class="val">${blank(company?.name)}</span></div>
    <div class="row"><span class="lbl">Account Number:</span><span class="val">___________________________</span></div>
    <div class="row"><span class="lbl">Bank:</span><span class="val">___________________________</span></div>
    <br/>
    <p>The Borrower may repay part or all of the loan before the due date, subject to applicable charges and interest
    for the current period. If the loan is transferred or refinanced by another financial institution, all due charges
    and interest remain payable. A delay exceeding <strong>${loan.gracePeriodDays > 0 ? loan.gracePeriodDays : 30}</strong> days
    may result in penalties and legal action.</p>
  </div>

  <!-- ARTICLE 5 -->
  <div class="article">
    <div class="article-title">Article 5: Termination of the Agreement</div>
    <p>The Lender reserves the right to terminate this Agreement and demand immediate repayment if:</p>
    <ol type="a">
      <li>The loan is used for purposes other than agreed</li>
      <li>Payment delay exceeds the agreed number of days</li>
      <li>False information is provided by the Borrower</li>
      <li>Collateral-related issues arise (registration, valuation, etc.)</li>
      <li>Bankruptcy or legal proceedings affect the Borrower's financial position</li>
    </ol>
    <p>The Lender retains the right to terminate this Agreement at any time under the above conditions.</p>
  </div>

  <!-- ARTICLE 6 -->
  <div class="article">
    <div class="article-title">Article 6: Collateral (Security)</div>
    <p>The Borrower provides the following collateral as security for the loan:</p>
    <div class="row"><span class="lbl">Type of Collateral:</span><span class="val">${blank(loan.collateralType)}</span></div>
    <div class="row"><span class="lbl">Collateral Value:</span><span class="val">${loan.collateralAmount ? "RWF " + fmt(loan.collateralAmount) : "___________________________"}</span></div>
    <div class="row"><span class="lbl">Eligible Collateral Value:</span><span class="val">${loan.eligibleCollateral ? "RWF " + fmt(loan.eligibleCollateral) : "___________________________"}</span></div>
    <div class="row"><span class="lbl">Description / Location:</span><span class="val">___________________________</span></div>
    <div class="row"><span class="lbl">Registration Details (if any):</span><span class="val">___________________________</span></div>
    <br/>
    <p>In case of default:</p>
    <ul>
      <li>The Lender has the right to recover the loan through legal means.</li>
      <li>The collateral may be sold to recover outstanding amounts.</li>
    </ul>
    <p>The Borrower must maintain the value of the collateral, shall not sell or modify it without written consent,
    and must allow inspection by the Lender when required.</p>
  </div>

  <!-- ARTICLE 7 -->
  <div class="article">
    <div class="article-title">Article 7: Credit Information Sharing</div>
    <p>The Borrower authorizes the Lender to share loan information with <strong>Credit Reference Bureau Africa Ltd</strong>.
    This does not constitute a breach of confidentiality. The Borrower has the right to access and request correction
    of their credit information.</p>
  </div>

  <!-- ARTICLE 8 -->
  <div class="article">
    <div class="article-title">Article 8: Costs and Expenses</div>
    <p>All costs related to execution of this Agreement, loan recovery processes, and collateral enforcement shall be
    borne by the Borrower.</p>
  </div>

  <!-- ARTICLE 9 -->
  <div class="article">
    <div class="article-title">Article 9: Communication</div>
    <p>All notices may be sent via:</p>
    <div class="row"><span class="lbl">Address:</span><span class="val">${blank(company?.address)}</span></div>
    <div class="row"><span class="lbl">Phone:</span><span class="val">${blank(company?.phone)}</span></div>
    <div class="row"><span class="lbl">Email:</span><span class="val">${blank(company?.email)}</span></div>
    <p>The Borrower must notify the Lender in writing of any changes to contact details.</p>
  </div>

  <!-- ARTICLE 10 -->
  <div class="article">
    <div class="article-title">Article 10: Dispute Resolution</div>
    <p>Any disputes shall first be resolved amicably. If unresolved, disputes shall be handled by competent courts of Rwanda.</p>
  </div>

  <!-- ARTICLE 11 -->
  <div class="article">
    <div class="article-title">Article 11: Acceptance of Terms</div>
    <p>The Borrower confirms that they have read and understood this Agreement and agree to all terms and conditions.</p>
    <br/>
    <p>Done at: <span class="field">${blank(company?.address?.split(",")[0])}</span></p>
    <p>Date: <span class="field" style="min-width:40pt;">&nbsp;&nbsp;&nbsp;&nbsp;</span> /
           <span class="field" style="min-width:40pt;">&nbsp;&nbsp;&nbsp;&nbsp;</span> /
           <span class="field" style="min-width:60pt;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
  </div>

  <hr class="thick" />

  <!-- SIGNATURES -->
  <div class="sig-section">
    <div class="article-title" style="text-align:center; margin-bottom: 14pt;">Signatures</div>
    <div class="sig-grid">
      <div>
        <p><strong>BORROWER</strong></p>
        <p>Name: <strong>${blank(customer.names)}</strong></p>
        <p>ID No: ${blank(customer.nationalId)}</p>
        <div class="sig-line"></div>
        <p style="font-size:9pt; color:#555;">Signature &amp; Date</p>
        <div class="stamp-area">Fingerprint /<br/>Stamp</div>
      </div>
      <div>
        <p><strong>LENDER</strong></p>
        <p>Company: <strong>${blank(company?.name)}</strong></p>
        <p>Representative: ${blank(md?.name)}</p>
        <div class="sig-line"></div>
        <p style="font-size:9pt; color:#555;">Signature &amp; Date</p>
        <div class="stamp-area">Official<br/>Stamp</div>
      </div>
    </div>
  </div>

</div><!-- /page -->
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
