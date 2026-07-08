import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { unauthorized, forbidden, serverError } from "@/lib/api-response";
import path from "path";

// xlsx-populate preserves all template styles/colors/borders on write
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XlsxPopulate = require("xlsx-populate");

// ── Date helpers ──────────────────────────────────────────────────────────────

// Used only for the FS sheet quarter-column lookup (needs a serial for comparison).
function toExcelDate(d: Date | null | undefined): number | undefined {
  if (!d) return undefined;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return Math.round((new Date(d).getTime() - epoch.getTime()) / 86400000);
}

// Returns a JS Date object so xlsx-populate writes the serial AND applies a
// date number format automatically — avoids cells displaying raw numbers.
function toDate(d: Date | string | null | undefined): Date | undefined {
  if (!d) return undefined;
  return new Date(d);
}

function calcAge(dob: Date | null | undefined): number | undefined {
  if (!dob) return undefined;
  const today = new Date();
  const b = new Date(dob);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RowValue = string | number | Date | undefined;
type LoanWithRel = Awaited<ReturnType<typeof fetchLoans>>[number];

// ── Cell helper (xlsx-populate is 1-indexed) ──────────────────────────────────

function setVal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any,
  row: number,
  col: number,
  value: RowValue
) {
  if (value === undefined || value === "") return;
  ws.row(row).cell(col).value(value);
}

// ── Sheet header fill ─────────────────────────────────────────────────────────
//
// BNR template header layout (1-indexed):
//   Classification sheets (A1.3-A1.8): NDFSP Name label at col 1 or 2,
//     value/placeholder cell at col 3.  Date placeholder at row 4 col 3.
//   Written Off (A1.9):                 value/placeholder at col 2, date at row 4 col 2.
//   FS sheet (A1.2):                    filled separately in fillFsSheet.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fillSheetHeader(ws: any, ndfspName: string, cutoffDate: Date, valueCol = 3) {
  const dateSerial = toExcelDate(cutoffDate) as number;
  ws.row(2).cell(valueCol).value(ndfspName);
  ws.row(4).cell(valueCol).value(dateSerial);
}

// ── Row builders ──────────────────────────────────────────────────────────────

function buildStandardRow(
  loan: LoanWithRel,
  idx: number,
  cutoffDate: Date
): RowValue[] {
  const cu = loan.customer;
  const outstanding = loan.balanceOutstanding;
  const instOut = loan.totalInstallments - loan.installmentsPaid;
  const netDue = Math.max(0, outstanding - (loan.eligibleCollateral ?? 0));

  return [
    idx + 1,                                               // 0  No
    cu.names,                                              // 1  Names
    cu.nationalId,                                         // 2  ID
    cu.phone,                                              // 3  Phone
    cu.gender,                                             // 4  Gender
    calcAge(cu.dateOfBirth),                               // 5  Age
    cu.relationshipWithNdfsp ?? "",                        // 6  Relationship
    cu.maritalStatus,                                      // 7  Marital Status
    undefined,                                             // 8  Prev. loans on time
    loan.purpose,                                          // 9  Purpose
    loan.branchName ?? "",                                 // 10 Branch
    loan.collateralType ?? "",                             // 11 Collateral Type
    loan.collateralAmount ?? 0,                            // 12 Collateral Amount
    cu.district,                                           // 13 District
    cu.sector,                                             // 14 Sector
    cu.cell,                                               // 15 Cell
    cu.village,                                            // 16 Village
    Number(loan.annualInterestRate) / 100,                 // 17 Interest Rate (decimal)
    loan.interestMethod === "flat" ? "Flat" : "Declining", // 18 Method
    loan.loanOfficer.name,                                 // 19 Loan Officer
    loan.disbursedAmount,                                  // 20 Disbursed Amount
    toExcelDate(loan.disbursementDate),                    // 21 Disbursement Date
    toExcelDate(loan.agreedMaturityDate),                  // 22 Maturity Date
    loan.repaymentFrequencyDays,                           // 23 Frequency (Days)
    loan.gracePeriodDays,                                  // 24 Grace Period
    toExcelDate(loan.firstPaymentDate),                    // 25 First Payment Date
    toExcelDate(loan.lastPaymentDate),                     // 26 Last Payment Date
    toExcelDate(loan.arrearsStartDate),                    // 27 Arrears Start
    toExcelDate(cutoffDate),                               // 28 Cut-Off Date
    loan.totalInstallments,                                // 29 Total Installments
    loan.installmentsPaid,                                 // 30 Paid Installments
    instOut,                                               // 31 Outstanding Installments
    loan.amountRepaidPrincipal,                            // 32 Amount Repaid
    outstanding,                                           // 33 Balance Outstanding
    loan.eligibleCollateral ?? 0,                          // 34 Eligible Collateral
    netDue,                                                // 35 Net Amount Due
    loan.daysOverdue,                                      // 36 Days Overdue
    loan.loanClass,                                        // 37 Class
    Number(loan.provisioningRate) / 100,                   // 38 Provisioning Rate (decimal)
    loan.provisionRequired,                                // 39 Provision Required
    loan.previousProvision,                                // 40 Previous Provisions
    loan.additionalProvision,                              // 41 Additional Provisions
  ];
}

// Substandard: extra "Other Institutions" column at position 9
function buildSubstandardRow(
  loan: LoanWithRel,
  idx: number,
  cutoffDate: Date
): RowValue[] {
  const row = buildStandardRow(loan, idx, cutoffDate);
  row.splice(9, 0, undefined);
  return row;
}

// Written-off sheet: different 24-column layout
function buildWrittenOffRow(loan: LoanWithRel): RowValue[] {
  const cu = loan.customer;
  return [
    cu.names,                                              // 0  Names
    cu.nationalId,                                         // 1  ID
    cu.phone,                                              // 2  Phone
    loan.id.slice(-10),                                    // 3  Account Number
    cu.gender,                                             // 4  Gender
    calcAge(cu.dateOfBirth),                               // 5  Age
    cu.relationshipWithNdfsp ?? "",                        // 6  Relationship
    Number(loan.annualInterestRate) / 100,                 // 7  Interest Rate
    loan.interestMethod === "flat" ? "Flat" : "Declining", // 8  Method
    loan.collateralType ?? "",                             // 9  Physical Guarantee
    cu.district,                                           // 10 District
    cu.sector,                                             // 11 Sector
    cu.cell,                                               // 12 Cell
    cu.village,                                            // 13 Village
    toExcelDate(loan.disbursementDate),                    // 14 Disbursement Date
    loan.disbursedAmount,                                  // 15 Disbursed Amount
    toExcelDate(loan.agreedMaturityDate),                  // 16 Maturity Date
    loan.amountRepaidPrincipal,                            // 17 Amount Repaid
    loan.balanceOutstanding,                               // 18 Balance Outstanding
    0,                                                     // 19 Security Savings
    loan.balanceOutstanding,                               // 20 Amount Written Off
    toExcelDate(loan.writtenOffDate),                      // 21 Date of Write Off
    0,                                                     // 22 Recoveries
    loan.balanceOutstanding,                               // 23 Remaining Balance
  ];
}

// ── Fill a classification sheet ───────────────────────────────────────────────
// dataStartRow is 1-indexed (matches xlsx-populate)

function fillClassSheet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any,
  loans: LoanWithRel[],
  dataStartRow: number,
  cutoffDate: Date,
  buildRow: (l: LoanWithRel, i: number, d: Date) => RowValue[]
) {
  loans.forEach((loan, i) => {
    const row = buildRow(loan, i, cutoffDate);
    row.forEach((val, c) => setVal(ws, dataStartRow + i, c + 1, val));
  });
}

// ── Fill FS financial summary sheet ──────────────────────────────────────────

// Template's accounting format renders 0 as "-"; this override makes it read as a literal 0.
const ZERO_AS_DIGIT_FORMAT = "_(* #,##0_);_(* (#,##0);_(* 0_);_(@_)";

function fillFsSheet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any,
  loans: LoanWithRel[],
  ndfspName: string,
  sector: string,
  district: string,
  bankAccountBalance: number,
  fixedAssetsGross: number,
  expenses: { category: string; amount: number }[]
) {
  // Rows 1-3: institution metadata (value in col 2)
  ws.row(1).cell(2).value(ndfspName);
  ws.row(2).cell(2).value(sector);
  ws.row(3).cell(2).value(district);

  // Template now has a single reporting-period column: D.
  const targetCol = 4;

  const activeLoans = loans.filter(
    (l) => !["written_off", "rejected", "pending"].includes(l.status)
  );
  const grossLoans    = activeLoans.reduce((s, l) => s + l.balanceOutstanding, 0);
  const totalProvision = activeLoans.reduce((s, l) => s + l.provisionRequired, 0);
  const npl = activeLoans
    .filter((l) => ["Substandard", "Doubtful", "Loss"].includes(l.loanClass))
    .reduce((s, l) => s + l.balanceOutstanding, 0);
  const interestFromCompleted = loans
    .filter((l) => l.status === "completed")
    .reduce((s, l) => s + l.amountRepaidInterest + l.additionalInterestPaid, 0);
  // All interest scheduled on every loan, whether collected yet or not.
  const totalInterestIncome = loans.reduce((s, l) => s + l.totalInterestScheduled, 0);
  const totalFeesIncome = loans.reduce(
    (s, l) => s + l.totalMgmtFeeScheduled + l.totalProcessingFeeScheduled,
    0
  );

  ws.row(6).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 2.Cash in vault — always 0
  ws.row(7).cell(targetCol).value(bankAccountBalance);            // 3.Cash in bank (Current account)
  ws.row(8).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 4.Cash in bank (Term deposit) — always 0
  // 5.Gross Loans (row 9) — left alone; template formula (=D93) computes it.
  ws.row(10).cell(targetCol).value(totalProvision);               // 6.Provisions
  ws.row(11).cell(targetCol).value(grossLoans - totalProvision);  // 7.Net Loans
  ws.row(12).cell(targetCol).value(npl);                          // 8.NPLs
  ws.row(13).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 9.Financial Instruments — always 0
  ws.row(14).cell(targetCol).value(fixedAssetsGross);             // Fixed Assets Gross Amount
  ws.row(17).cell(targetCol).value(interestFromCompleted);        // 11.Interest receivable (interest from completed loans)
  ws.row(19).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 13.Suspense Accounts — always 0
  ws.row(27).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 21.Subsidies — always 0
  ws.row(28).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 22.Revaluation surplus — always 0
  ws.row(29).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 23.Other Equity — always 0
  ws.row(40).cell(targetCol).value(totalInterestIncome);          // 32.Interest Income on Loan Portfolio
  ws.row(41).cell(targetCol).value(totalFeesIncome);              // 33.Fees and Commissions on Loan Portfolio
  ws.row(42).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 34.Incomes on Deposits in banks and other FIs — always 0
  ws.row(43).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 35.Incomes on Financial Instruments — always 0
  ws.row(44).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 36.Other financial Income — always 0
  ws.row(45).cell(targetCol).value(0).style("numberFormat", ZERO_AS_DIGIT_FORMAT); // 37.Recoveries on Loans (prov. Back) — always 0

  const sumByCategory = (category: string) =>
    expenses.filter((e) => e.category === category).reduce((s, e) => s + e.amount, 0);

  ws.row(53).cell(targetCol).value(sumByCategory("Bank Charges"));             // 45.Bank Charges, Commissions and other Financial Exp.
  ws.row(56).cell(targetCol).value(sumByCategory("Personal Expenses"));        // 48.Personnel Expenses (Gross amount)
  ws.row(57).cell(targetCol).value(sumByCategory("Administrative Expenses")); // 49.Administrative Expenses

  // Supplementary gender breakdown (rows 73-80)
  const men    = activeLoans.filter((l) => ["male",   "m"].includes((l.customer.gender ?? "").toLowerCase()));
  const women  = activeLoans.filter((l) => ["female", "f"].includes((l.customer.gender ?? "").toLowerCase()));
  const groups = activeLoans.filter((l) => !["male","m","female","f"].includes((l.customer.gender ?? "").toLowerCase()));
  const sumBal = (arr: LoanWithRel[]) => arr.reduce((s, l) => s + l.balanceOutstanding, 0);

  ws.row(73).cell(targetCol).value(men.length);
  ws.row(74).cell(targetCol).value(women.length);
  ws.row(75).cell(targetCol).value(groups.length);
  ws.row(76).cell(targetCol).value(activeLoans.length);
  ws.row(77).cell(targetCol).value(sumBal(men));
  ws.row(78).cell(targetCol).value(sumBal(women));
  ws.row(79).cell(targetCol).value(sumBal(groups));
  ws.row(80).cell(targetCol).value(grossLoans);

  // Outstanding balance by economic sector (rows 81-85)
  const sumBySector = (sector: string) =>
    activeLoans.filter((l) => l.economicSector === sector).reduce((s, l) => s + l.balanceOutstanding, 0);

  ws.row(81).cell(targetCol).value(sumBySector("Agriculture, Livestock, Fishing"));
  ws.row(82).cell(targetCol).value(sumBySector("Public Works (Construction), Buildings, Residences/Homes"));
  ws.row(83).cell(targetCol).value(sumBySector("Commerce, Restaurants, Hotels"));
  ws.row(84).cell(targetCol).value(sumBySector("Transport, Warehouses, Communications"));
  ws.row(85).cell(targetCol).value(sumBySector("Others"));
}

// ── Prisma fetch ──────────────────────────────────────────────────────────────

async function fetchLoans(companyId: string) {
  return prisma.loan.findMany({
    where: { companyId },
    include: {
      customer: {
        select: {
          names: true, nationalId: true, phone: true, gender: true,
          dateOfBirth: true, maritalStatus: true, district: true,
          sector: true, cell: true, village: true, relationshipWithNdfsp: true,
        },
      },
      loanOfficer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const { searchParams } = new URL(request.url);
    const reportingDateStr =
      searchParams.get("reportingDate") ?? new Date().toISOString().split("T")[0];
    const institutionName = searchParams.get("institutionName") ?? "NDF Institution";
    const sector   = searchParams.get("sector")   ?? "";
    const district = searchParams.get("district") ?? "";
    const cutoffDate = new Date(reportingDateStr);

    // Only loans disbursed within the reporting window (Mar 1 – Jun 30 of the reporting year).
    const reportYear = cutoffDate.getFullYear();
    const windowStart = new Date(Date.UTC(reportYear, 2, 1));
    const windowEnd   = new Date(Date.UTC(reportYear, 5, 30));
    const [allLoans, company, assetTotal, expenses] = await Promise.all([
      fetchLoans(auth.companyId),
      prisma.company.findUnique({ where: { id: auth.companyId }, select: { accountBalance: true } }),
      prisma.asset.aggregate({ where: { companyId: auth.companyId }, _sum: { purchaseValue: true } }),
      prisma.expense.findMany({
        where: { companyId: auth.companyId, date: { gte: windowStart, lte: windowEnd } },
        select: { category: true, amount: true },
      }),
    ]);
    const fixedAssetsGross = assetTotal._sum.purchaseValue ?? 0;
    const loans = allLoans.filter((l) => {
      if (!l.disbursementDate) return false;
      const d = new Date(l.disbursementDate);
      return d >= windowStart && d <= windowEnd;
    });

    const normal       = loans.filter((l) => l.loanClass === "Normal"      && !l.isRestructured && l.status !== "written_off");
    const watch        = loans.filter((l) => l.loanClass === "Watch"       && !l.isRestructured && l.status !== "written_off");
    const substandard  = loans.filter((l) => l.loanClass === "Substandard" && !l.isRestructured && l.status !== "written_off");
    const doubtful     = loans.filter((l) => l.loanClass === "Doubtful"    && !l.isRestructured && l.status !== "written_off");
    const loss         = loans.filter((l) => l.loanClass === "Loss"        && !l.isRestructured && l.status !== "written_off");
    const restructured = loans.filter((l) => l.isRestructured && l.status !== "written_off");
    const writtenOff   = loans.filter((l) => l.status === "written_off");

    // Load template — xlsx-populate operates on the raw XML zip so all
    // colors, borders, and column widths are 100% preserved on output.
    const templatePath = path.join(process.cwd(), "templates", "bnr-template.xlsx");
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);

    // A1.3 Normal Loans — data starts row 12, 42 cols
    {
      const ws = workbook.sheet("A1.3. Normal Loans");
      if (ws) { fillSheetHeader(ws, institutionName, cutoffDate); fillClassSheet(ws, normal, 12, cutoffDate, buildStandardRow); }
    }

    // A1.4 Watch — data starts row 12, 42 cols
    {
      const ws = workbook.sheet("A1.4. Watch");
      if (ws) { fillSheetHeader(ws, institutionName, cutoffDate); fillClassSheet(ws, watch, 12, cutoffDate, buildStandardRow); }
    }

    // A1.5 Substandard — data starts row 12, 43 cols (extra Other Institutions col)
    {
      const ws = workbook.sheet("A1.5. Substandard");
      if (ws) { fillSheetHeader(ws, institutionName, cutoffDate); fillClassSheet(ws, substandard, 12, cutoffDate, buildSubstandardRow); }
    }

    // A1.6 Doubtful — data starts row 11, 42 cols
    {
      const ws = workbook.sheet("A1.6. Doubtful");
      if (ws) { fillSheetHeader(ws, institutionName, cutoffDate); fillClassSheet(ws, doubtful, 11, cutoffDate, buildStandardRow); }
    }

    // A1.7 Loss — data starts row 11, 42 cols
    {
      const ws = workbook.sheet("A1.7 Loss");
      if (ws) { fillSheetHeader(ws, institutionName, cutoffDate); fillClassSheet(ws, loss, 11, cutoffDate, buildStandardRow); }
    }

    // A1.8 Restructured — data starts row 11, 42 cols
    {
      const ws = workbook.sheet("A1.8. Restructured loans");
      if (ws) { fillSheetHeader(ws, institutionName, cutoffDate); fillClassSheet(ws, restructured, 11, cutoffDate, buildStandardRow); }
    }

    // A1.9 Written off — data starts row 9, 24 cols, header valueCol=2
    {
      const ws = workbook.sheet("A1.9. Written off");
      if (ws) {
        fillSheetHeader(ws, institutionName, cutoffDate, 2);
        writtenOff.forEach((loan, i) => {
          const row = buildWrittenOffRow(loan);
          row.forEach((val, c) => setVal(ws, 9 + i, c + 1, val));
        });
      }
    }

    // A1.2 FS — fill loan totals into the reporting-period column
    {
      const ws = workbook.sheet("A1.2. FS");
      if (ws) fillFsSheet(ws, loans, institutionName, sector, district, company?.accountBalance ?? 0, fixedAssetsGross, expenses);
    }

    const buffer = await workbook.outputAsync();
    const filename = `BNR_${reportingDateStr.replace(/-/g, "")}_${institutionName.replace(/\s+/g, "_")}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
