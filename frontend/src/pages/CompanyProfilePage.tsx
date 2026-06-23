import { appName, brandName, businessUnitName, companyContextName, companyLogoSrc, companyName, companyProfile } from "../lib/brand";

function ChipList({ items }: { items: string[] }) {
  return <div className="chip-list">{items.map((item) => <span className="info-chip" key={item}>{item}</span>)}</div>;
}

export function CompanyProfilePage() {
  return (
    <section className="page-stack">
      <div className="panel company-profile-hero">
        <span className="logo-mark company-profile-logo">
          <img src={companyLogoSrc} alt={brandName} />
        </span>
        <div>
          <p>{companyContextName}</p>
          <h2>{companyName}</h2>
          <small>{appName} Safety Operations for industrial tyre manufacturing and operational risk control.</small>
        </div>
      </div>

      <div className="grid two">
        <div className="panel company-card">
          <h2>Company Details</h2>
          <div className="definition-list">
            <span>Company Name</span><strong>{companyName}</strong>
            <span>Brand</span><strong>{brandName}</strong>
            <span>Business Unit</span><strong>{businessUnitName}</strong>
            <span>Head Office</span><strong>{companyProfile.headOffice}</strong>
            <span>Factory</span><strong>{companyProfile.factory}</strong>
            <span>Phone</span><strong>{companyProfile.phone}</strong>
            <span>Email</span><strong>{companyProfile.email}</strong>
          </div>
        </div>

        <div className="panel company-card">
          <h2>HSE Context</h2>
          <p>{companyProfile.industrySummary}</p>
          <h3>Product / Process Areas</h3>
          <ChipList items={companyProfile.productAreas} />
        </div>

        <div className="panel company-card">
          <h2>Compliance & Policy</h2>
          <p>Policy and management-system references for HSE reporting, reviews and audits.</p>
          <ChipList items={[...companyProfile.policyReferences, ...companyProfile.certifications]} />
        </div>

        <div className="panel company-card">
          <h2>Values</h2>
          <div className="values-grid">
            {companyProfile.values.map((value) => <span key={value}>{value}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
