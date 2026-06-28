import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const companyProfileRouter = Router();
companyProfileRouter.use(requireAuth);

const defaultRows = [
  { key: "appName", section: "Identity", label: "App Name", value: "HSE", fieldType: "text", sortOrder: 1 },
  { key: "companyName", section: "Identity", label: "Company Name", value: "LAUGFS Corporation (Rubber) Limited", fieldType: "text", sortOrder: 2 },
  { key: "brandName", section: "Identity", label: "Brand Name", value: "LAUGFS Rubber", fieldType: "text", sortOrder: 3 },
  { key: "businessUnitName", section: "Identity", label: "Business Unit Name", value: "LAUGFS Industrial Tyres", fieldType: "text", sortOrder: 4 },
  { key: "companyLogoSrc", section: "Identity", label: "Company Logo Path", value: "/brand/laugfs-rubber-logo.jpg", fieldType: "text", sortOrder: 5 },

  { key: "headOffice", section: "Contact", label: "Head Office", value: "No: 101, Maya Avenue, Colombo 06, Sri Lanka", fieldType: "textarea", sortOrder: 10 },
  { key: "factory", section: "Contact", label: "Factory", value: "Miriswaththa, Millewa, Horana, Sri Lanka", fieldType: "textarea", sortOrder: 11 },
  { key: "phone", section: "Contact", label: "Phone", value: "+94 11 5 566 222", fieldType: "text", sortOrder: 12 },
  { key: "email", section: "Contact", label: "Email", value: "info.rubber@laugfs.lk", fieldType: "text", sortOrder: 13 },

  { key: "industrySummary", section: "Overview", label: "Industry Summary", value: "Industrial tyre manufacturing and off-the-road mobility applications for material handling, construction, ground support equipment and specialist industrial use.", fieldType: "textarea", sortOrder: 20 },
  { key: "sharedOverview", section: "Overview", label: "Shared Overview", value: "LAUGFS Corporation (Rubber) Limited is the industrial tyre manufacturing arm of LAUGFS Rubber, supporting material handling, construction, ground support, and specialist industrial applications with a focus on safety, quality, sustainability, and operational excellence.", fieldType: "textarea", sortOrder: 21 },

  { key: "productAreas", section: "Lists", label: "Product Areas", value: "Material Handling\nConstruction\nGSE\nCured On\nSuper Solids\nDual Assembly\nPneumatic\nComfort Series\nSpecial Purpose", fieldType: "list", sortOrder: 30 },
  { key: "policyReferences", section: "Lists", label: "Policy References", value: "HSE Policy\nQuality Policy\nEnergy Policy\nEthical Trading Policy", fieldType: "list", sortOrder: 31 },
  { key: "certifications", section: "Lists", label: "Certifications", value: "ISO 9001:2015\nISO 14001:2015\nISO 45001:2018\nISO 50001:2018", fieldType: "list", sortOrder: 32 },
  { key: "values", section: "Lists", label: "Company Values", value: "Integrity & Accountability\nInnovation & Creativity\nSynergy & Teamwork\nCustomer Centricity\nResilient Leadership\nAgility to Change", fieldType: "list", sortOrder: 33 },
  { key: "integratedContext", section: "Lists", label: "Integrated Context", value: "HSE Management\nESG Monitoring\nQuality Control\nCompliance Tracking\nOperational Risk Management\nSustainability Performance", fieldType: "list", sortOrder: 34 },
];

async function ensureDefaultRows() {
  for (const row of defaultRows) {
    await prisma.companyProfileField.upsert({
      where: { key: row.key },
      create: row,
      update: {},
    });
  }
}

function splitList(value: string | null | undefined) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getValue(rows: any[], key: string, fallback = "") {
  return rows.find((row) => row.key === key)?.value ?? fallback;
}

function getList(rows: any[], key: string, fallback: string[] = []) {
  const value = getValue(rows, key, "");
  const list = splitList(value);
  return list.length ? list : fallback;
}

companyProfileRouter.get("/", async (_req, res, next) => {
  try {
    await ensureDefaultRows();

    const rows = await prisma.companyProfileField.findMany({
      where: { isActive: true },
      orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
    });

    const companyName = getValue(rows, "companyName", "LAUGFS Corporation (Rubber) Limited");
    const brandName = getValue(rows, "brandName", "LAUGFS Rubber");
    const businessUnitName = getValue(rows, "businessUnitName", "LAUGFS Industrial Tyres");

    res.json({
      appName: getValue(rows, "appName", "HSE"),
      companyName,
      officialCompanyName: companyName,
      brandName,
      businessUnitName,
      companyLogoSrc: getValue(rows, "companyLogoSrc", "/brand/laugfs-rubber-logo.jpg"),
      companyContextName: `${brandName} / ${businessUnitName}`,
      sharedOverview: getValue(rows, "sharedOverview"),
      integratedContext: getList(rows, "integratedContext"),
      companyProfile: {
        headOffice: getValue(rows, "headOffice"),
        factory: getValue(rows, "factory"),
        phone: getValue(rows, "phone"),
        email: getValue(rows, "email"),
        industrySummary: getValue(rows, "industrySummary"),
        productAreas: getList(rows, "productAreas"),
        policyReferences: getList(rows, "policyReferences"),
        certifications: getList(rows, "certifications"),
        values: getList(rows, "values"),
      },
      fields: rows,
    });
  } catch (error) {
    next(error);
  }
});
