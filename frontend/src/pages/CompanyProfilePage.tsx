import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  brandName as fallbackBrandName,
  businessUnitName as fallbackBusinessUnitName,
  companyLogoSrc as fallbackCompanyLogoSrc,
  companyName as fallbackCompanyName,
  companyProfile as fallbackCompanyProfile,
} from "../lib/brand";

type AccentTone = "cyan" | "blue" | "green" | "gold" | "purple" | "teal";
type IconKind = "building" | "spark" | "layers" | "factory" | "office" | "phone" | "mail" | "leaf" | "shield" | "check" | "globe" | "star" | "gear";

type CompanyProfileApi = {
  companyName: string;
  brandName: string;
  businessUnitName: string;
  companyLogoSrc: string;
  sharedOverview: string;
  integratedContext: string[];
  companyProfile: {
    headOffice: string;
    factory: string;
    phone: string;
    email: string;
    industrySummary: string;
    productAreas: string[];
    policyReferences: string[];
    certifications: string[];
    values: string[];
  };
};

const fallbackProfile: CompanyProfileApi = {
  companyName: fallbackCompanyName,
  brandName: fallbackBrandName,
  businessUnitName: fallbackBusinessUnitName,
  companyLogoSrc: fallbackCompanyLogoSrc,
  sharedOverview: "LAUGFS Corporation (Rubber) Limited is the industrial tyre manufacturing arm of LAUGFS Rubber, supporting material handling, construction, ground support, and specialist industrial applications with a focus on safety, quality, sustainability, and operational excellence.",
  integratedContext: [
    "HSE Management",
    "ESG Monitoring",
    "Quality Control",
    "Compliance Tracking",
    "Operational Risk Management",
    "Sustainability Performance",
  ],
  companyProfile: fallbackCompanyProfile,
};

function ProfileIcon({ kind }: { kind: IconKind }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (kind) {
    case "building":
      return <svg {...props}><path d="M4 20h16" /><path d="M7 20V7h10v13" /><path d="M9 10h2M13 10h2M9 13h2M13 13h2M9 16h2M13 16h2" /></svg>;
    case "spark":
      return <svg {...props}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /></svg>;
    case "layers":
      return <svg {...props}><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 16 8 4 8-4" /></svg>;
    case "factory":
      return <svg {...props}><path d="M4 20h16" /><path d="M5 20v-8l5 3V8l4 3V6l5 3v11" /><path d="M9 20v-3M13 20v-4M17 20v-5" /></svg>;
    case "office":
      return <svg {...props}><path d="M5 20h14" /><path d="M7 20V8h10v12" /><path d="M9 11h2M13 11h2M9 14h2M13 14h2" /><path d="M10 8V5h4v3" /></svg>;
    case "phone":
      return <svg {...props}><path d="M8 4h3l2 5-2 1c1.5 3 3.5 5 6 6l1-2 5 2v3c0 1-1 2-2 2-10 0-18-8-18-18 0-1 1-2 2-2Z" /></svg>;
    case "mail":
      return <svg {...props}><rect x="4" y="6" width="16" height="12" rx="2" /><path d="m5 7 7 6 7-6" /></svg>;
    case "leaf":
      return <svg {...props}><path d="M20 4c-7 0-13 5-14 12 0 2 1 4 4 4 7 0 12-7 12-16Z" /><path d="M7 17c4-5 8-8 13-10" /></svg>;
    case "shield":
      return <svg {...props}><path d="M12 3 5 6v5c0 5 3 9 7 10 4-1 7-5 7-10V6l-7-3Z" /><path d="M12 8v6M9 11h6" /></svg>;
    case "check":
      return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="m9 12 2 2 4-5" /></svg>;
    case "globe":
      return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4a11 11 0 0 0 0 16M12 4a11 11 0 0 1 0 16" /></svg>;
    case "star":
      return <svg {...props}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.8-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>;
    case "gear":
      return <svg {...props}><circle cx="12" cy="12" r="3.2" /><path d="M19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.5-1.5M5.5 18.5 7 17M17 17l1.5 1.5M5.5 5.5 7 7" /></svg>;
    default:
      return null;
  }
}

function AccentChipList({ items, tone = "cyan" }: { items: string[]; tone?: AccentTone }) {
  return <div className={`cp-chip-list cp-chip-list-${tone}`}>{items.map((item) => <span key={item}>{item}</span>)}</div>;
}

function SectionHeading({ eyebrow, title, detail, icon }: { eyebrow: string; title: string; detail: string; icon: IconKind }) {
  return (
    <header className="cp-section-heading">
      <div className="cp-section-heading-main">
        <span className="cp-section-badge">
          <ProfileIcon kind={icon} />
          <span>{eyebrow}</span>
        </span>
        <h2>{title}</h2>
      </div>
      <small>{detail}</small>
    </header>
  );
}

function IdentityCard({ label, value, note, tone, icon }: { label: string; value: string; note: string; tone: AccentTone; icon: IconKind }) {
  return (
    <article className={`cp-identity-card cp-tone-${tone}`}>
      <span className="cp-card-icon"><ProfileIcon kind={icon} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

export function CompanyProfilePage() {
  const [profile, setProfile] = useState<CompanyProfileApi>(fallbackProfile);
  const [status, setStatus] = useState("Loading company profile...");

  useEffect(() => {
    api<CompanyProfileApi>("/api/company-profile")
      .then((data) => {
        setProfile(data);
        setStatus("Database-backed company profile");
      })
      .catch(() => {
        setStatus("Static fallback profile");
      });
  }, []);

  const { companyName, brandName, businessUnitName, companyLogoSrc, companyProfile } = profile;

  const identityCards = [
    { label: "Company Name", value: companyName, note: "Legal entity", tone: "cyan" as AccentTone, icon: "building" as IconKind },
    { label: "Brand", value: brandName, note: "Public brand identity", tone: "blue" as AccentTone, icon: "spark" as IconKind },
    { label: "Business Unit", value: businessUnitName, note: "Industrial tyre operations", tone: "green" as AccentTone, icon: "layers" as IconKind },
    { label: "Factory", value: companyProfile.factory, note: "Production site", tone: "teal" as AccentTone, icon: "factory" as IconKind },
    { label: "Head Office", value: companyProfile.headOffice, note: "Corporate office", tone: "gold" as AccentTone, icon: "office" as IconKind },
    { label: "Phone", value: companyProfile.phone, note: "Main contact", tone: "purple" as AccentTone, icon: "phone" as IconKind },
    { label: "Email", value: companyProfile.email, note: "Corporate inbox", tone: "cyan" as AccentTone, icon: "mail" as IconKind },
  ];

  const moduleCards = [
    {
      title: "HSE Operations",
      tone: "teal" as AccentTone,
      icon: "shield" as IconKind,
      copy: "Accident reporting, corrective actions, medical expenses, near miss/unsafe observations, working hours, AFR, TF/TS.",
      chips: ["Accident register", "Corrective actions", "Medical expenses", "Near miss / unsafe", "Working hours", "AFR", "TF/TS"],
    },
    {
      title: "ESG Management",
      tone: "gold" as AccentTone,
      icon: "leaf" as IconKind,
      copy: "GHG emission intensity, scrap flash waste reduction, waste recycling, noise monitoring, TF/TS, stakeholder concerns.",
      chips: ["GHG intensity", "Scrap flash waste", "Waste recycling", "Noise monitoring", "TF/TS", "Stakeholder concerns"],
    },
  ];

  const policyChips = [...companyProfile.policyReferences, ...companyProfile.certifications];

  return (
    <section className="company-profile-page">
      <header className="cp-hero cp-card">
        <div className="cp-hero-brand">
          <span className="cp-logo">
            <img src={companyLogoSrc} alt={brandName} />
          </span>
          <div className="cp-hero-copy">
            <p>Company Profile</p>
            <h1>{companyName}</h1>
            <small>{brandName} / {businessUnitName}</small>
            <span>{companyProfile.industrySummary}</span>
          </div>
        </div>

        <div className="cp-hero-side">
          <span className="cp-kicker">{status}</span>
          <strong>One profile for HSE and ESG</strong>
          <p>Company profile information is used across HSE and ESG dashboards for consistent reporting identity.</p>
          <div className="cp-mini-stats">
            <div>
              <strong>2</strong>
              <span>Modules</span>
            </div>
            <div>
              <strong>1</strong>
              <span>Shared profile</span>
            </div>
          </div>
        </div>
      </header>

      <section className="cp-section cp-card cp-section-overview">
        <SectionHeading eyebrow="Identity" title="Corporate Profile" detail="Shared across the HSE and ESG modules" icon="building" />
        <div className="cp-identity-grid">
          {identityCards.map((item) => <IdentityCard key={item.label} {...item} />)}
        </div>
      </section>

      <div className="cp-split-grid">
        <section className="cp-card cp-overview-card">
          <SectionHeading eyebrow="Corporate Overview" title="Common company context" detail="A single identity layer for the unified management system" icon="star" />
          <p className="cp-copy">{profile.sharedOverview}</p>
          <div className="cp-inline-summary">
            <div>
              <span>Factory</span>
              <strong>{companyProfile.factory}</strong>
            </div>
            <div>
              <span>Head Office</span>
              <strong>{companyProfile.headOffice}</strong>
            </div>
            <div>
              <span>Brand</span>
              <strong>{brandName}</strong>
            </div>
          </div>
        </section>

        <section className="cp-card">
          <SectionHeading eyebrow="Operational Scope" title="Product and process families" detail="Representative areas supported by the factory" icon="factory" />
          <AccentChipList items={companyProfile.productAreas} tone="green" />
        </section>
      </div>

      <div className="cp-split-grid">
        <section className="cp-card">
          <SectionHeading eyebrow="Integrated Management Context" title="Common operating context" detail="Shared control language across HSE, ESG, quality, and compliance" icon="globe" />
          <AccentChipList items={profile.integratedContext} tone="cyan" />
        </section>

        <section className="cp-card">
          <SectionHeading eyebrow="Compliance & Policy" title="Policy and standard references" detail="Core references used across reviews, audits, and reporting" icon="check" />
          <AccentChipList items={policyChips} tone="gold" />
        </section>
      </div>

      <div className="cp-split-grid">
        <section className="cp-card">
          <SectionHeading eyebrow="Values" title="Company values" detail="The culture behind the management system" icon="spark" />
          <div className="cp-values-grid">
            {companyProfile.values.map((value, index) => (
              <article key={value} className={`cp-value-card cp-value-${["cyan", "green", "gold", "blue", "purple", "teal"][index % 6]}` as string}>
                <span><ProfileIcon kind="star" /></span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="cp-card">
          <SectionHeading eyebrow="Module Connections" title="How the company profile supports the system" detail="Reference points that feed both major modules" icon="gear" />
          <div className="cp-module-grid">
            {moduleCards.map((card) => (
              <article key={card.title} className={`cp-module-card cp-tone-${card.tone}`}>
                <div className="cp-module-head">
                  <span className="cp-card-icon"><ProfileIcon kind={card.icon} /></span>
                  <div>
                    <span>{card.title}</span>
                    <strong>{card.copy}</strong>
                  </div>
                </div>
                <AccentChipList items={card.chips} tone={card.tone} />
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="cp-note-card cp-card">
        <span className="cp-card-icon"><ProfileIcon kind="gear" /></span>
        <div>
          <strong>Admin / System Note</strong>
          <p>Edit company profile values from Data Center &gt; Data Entry Center &gt; Company Profile Data.</p>
        </div>
      </section>
    </section>
  );
}
