// ── ICP taxonomy + suggestion data ───────────────────────────────────────
//
// This is the "niks fake" lookup data behind the guided ICP editor. Every list
// mirrors what the live Unipile `GET /linkedin/search/parameters` lookup and
// the Sales Navigator lead filter set actually return, so the guided editor
// feels live before the LinkedIn account is connected (see icp_filter_research.md).
//
// When the LinkedIn connection lands (roadmap step 14/17), INDUSTRY_TAXONOMY
// and REGION_TAXONOMY are the only two lists that swap to a live
// `search/parameters?type=SALES_INDUSTRY` / `type=REGION` call — the fixed
// enums (seniority / function / company size / type / years) stay local because
// LinkedIn's enums are stable. TITLE_SUGGESTIONS also swaps to the live
// role-typeahead later; until then it uses the curated map below.
//
// Nothing here is invented: industries are LinkedIn's own Sales Navigator
// industry names, regions are real geographies, and the title suggestions are
// the common real-world titles for each function × seniority pair.

// ── Industries ────────────────────────────────────────────────────────────
// The most-used slice of LinkedIn's ~400 Sales Navigator industries. The
// guided editor shows these as a searchable (fuzzy) list; typing filters it.
// Grouped only for readability here — the UI presents one flat searchable list.
export const INDUSTRY_TAXONOMY: string[] = [
  // Technology
  'Software Development',
  'Technology, Information and Internet',
  'IT Services and IT Consulting',
  'Computer and Network Security',
  'Data Infrastructure and Analytics',
  'Telecommunications',
  'Computer Hardware',
  'Semiconductors',
  // Financial
  'Financial Services',
  'Banking',
  'Investment Management',
  'Venture Capital and Private Equity',
  'Insurance',
  'Accounting',
  // Professional services
  'Business Consulting and Services',
  'Management Consulting',
  'Law Practice',
  'Legal Services',
  'Marketing Services',
  'Advertising Services',
  'Design Services',
  'Staffing and Recruiting',
  'Human Resources Services',
  // Health
  'Hospitals and Health Care',
  'Medical Practices',
  'Pharmaceutical Manufacturing',
  'Biotechnology Research',
  'Medical Equipment Manufacturing',
  'Mental Health Care',
  // Industry & manufacturing
  'Manufacturing',
  'Machinery Manufacturing',
  'Automotive',
  'Chemical Manufacturing',
  'Food and Beverage Manufacturing',
  'Electrical Equipment Manufacturing',
  // Consumer & retail
  'Retail',
  'Consumer Goods',
  'Food and Beverage Services',
  'Apparel and Fashion',
  'Wholesale',
  'E-Commerce',
  // Real estate & construction
  'Real Estate',
  'Construction',
  'Architecture and Planning',
  'Civil Engineering',
  // Media & education
  'Media Production',
  'Broadcast Media',
  'Publishing',
  'Higher Education',
  'E-Learning Providers',
  'Education Administration Programs',
  // Energy, transport, public
  'Oil and Gas',
  'Renewable Energy Semiconductor Manufacturing',
  'Utilities',
  'Transportation, Logistics, Supply Chain and Storage',
  'Airlines and Aviation',
  'Government Administration',
  'Non-profit Organizations',
  'Hospitality',
  'Travel Arrangements',
  'Farming',
  'Mining',
];

// ── Regions / geographies ──────────────────────────────────────────────────
// Real geographies used for BOTH person location and company HQ location. The
// guided editor shows these as a searchable list; typing filters it. Macro
// regions first, then countries, then major cities.
export const REGION_TAXONOMY: string[] = [
  // Macro regions
  'European Union',
  'EMEA',
  'DACH (Germany, Austria, Switzerland)',
  'Benelux',
  'Nordics',
  'North America',
  'APAC',
  'Latin America',
  'Middle East and North Africa',
  // Countries
  'Netherlands',
  'Belgium',
  'Germany',
  'France',
  'United Kingdom',
  'Ireland',
  'Spain',
  'Italy',
  'Portugal',
  'Switzerland',
  'Austria',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Poland',
  'United States',
  'Canada',
  'Australia',
  'India',
  'Singapore',
  'United Arab Emirates',
  'Brazil',
  // Major cities
  'Amsterdam',
  'Rotterdam',
  'Utrecht',
  'The Hague',
  'Eindhoven',
  'Brussels',
  'Antwerp',
  'London',
  'Berlin',
  'Munich',
  'Paris',
  'Madrid',
  'Barcelona',
  'Milan',
  'Dublin',
  'Stockholm',
  'Copenhagen',
  'Zurich',
  'New York',
  'San Francisco',
  'Toronto',
];

// ── Title suggestions ───────────────────────────────────────────────────────
// Curated real-world job titles per function × seniority. The guided editor
// uses the SELECTED functions + seniority to surface a suggestion set the user
// can one-click add (instead of typing from a blank field). Keyed by function;
// inner map keyed by a coarse seniority bucket derived from the selected
// seniority chips.
//
// Seniority buckets (map from SENIORITY_OPTIONS):
//   'exec'    <- 'Owner / Partner', 'C-Suite', 'Vice President'
//   'lead'    <- 'Director', 'Experienced Manager', 'Entry Manager'
//   'ic'      <- 'Senior', 'Strategic', 'Entry', 'In Training'
export type SeniorityBucket = 'exec' | 'lead' | 'ic';

export const SENIORITY_TO_BUCKET: Record<string, SeniorityBucket> = {
  'Owner / Partner': 'exec',
  'C-Suite': 'exec',
  'Vice President': 'exec',
  Director: 'lead',
  'Experienced Manager': 'lead',
  'Entry Manager': 'lead',
  Senior: 'ic',
  Strategic: 'ic',
  Entry: 'ic',
  'In Training': 'ic',
};

// function label -> bucket -> suggested titles
export const TITLE_SUGGESTIONS: Record<string, Record<SeniorityBucket, string[]>> = {
  Sales: {
    exec: ['VP Sales', 'VP Revenue', 'Chief Revenue Officer', 'Head of Sales', 'Head of Revenue'],
    lead: ['Sales Director', 'Regional Sales Manager', 'Sales Manager', 'Head of Business Development'],
    ic: ['Account Executive', 'Senior Account Executive', 'Business Development Representative', 'Sales Development Representative'],
  },
  Marketing: {
    exec: ['VP Marketing', 'Chief Marketing Officer', 'Head of Marketing', 'Head of Growth'],
    lead: ['Marketing Director', 'Demand Generation Manager', 'Growth Marketing Manager', 'Brand Manager'],
    ic: ['Marketing Manager', 'Growth Marketer', 'Content Marketer', 'Performance Marketer'],
  },
  'Business Development': {
    exec: ['VP Business Development', 'Head of Partnerships', 'Chief Business Officer'],
    lead: ['Business Development Director', 'Partnerships Manager', 'Business Development Manager'],
    ic: ['Business Development Representative', 'Partnerships Lead', 'Business Development Executive'],
  },
  'Information Technology': {
    exec: ['CTO', 'CIO', 'VP Engineering', 'Head of IT', 'VP Technology'],
    lead: ['Engineering Manager', 'IT Director', 'Head of Infrastructure', 'Engineering Lead'],
    ic: ['Software Engineer', 'Senior Software Engineer', 'DevOps Engineer', 'Systems Administrator'],
  },
  Engineering: {
    exec: ['VP Engineering', 'CTO', 'Head of Engineering', 'VP Product Engineering'],
    lead: ['Engineering Manager', 'Engineering Lead', 'Director of Engineering', 'Staff Engineer'],
    ic: ['Software Engineer', 'Senior Software Engineer', 'Backend Engineer', 'Frontend Engineer'],
  },
  Finance: {
    exec: ['CFO', 'VP Finance', 'Head of Finance', 'Finance Director'],
    lead: ['Finance Manager', 'FP&A Manager', 'Controller', 'Head of Accounting'],
    ic: ['Financial Analyst', 'Senior Accountant', 'FP&A Analyst', 'Controller'],
  },
  'Human Resources': {
    exec: ['CHRO', 'VP People', 'Head of People', 'VP Human Resources'],
    lead: ['HR Director', 'People Operations Manager', 'Talent Acquisition Manager', 'HR Manager'],
    ic: ['HR Business Partner', 'Recruiter', 'People Operations Specialist', 'Talent Partner'],
  },
  Operations: {
    exec: ['COO', 'VP Operations', 'Head of Operations'],
    lead: ['Operations Director', 'Operations Manager', 'Head of Revenue Operations'],
    ic: ['Operations Analyst', 'Revenue Operations Manager', 'Operations Specialist'],
  },
  'Product Management': {
    exec: ['VP Product', 'Chief Product Officer', 'Head of Product'],
    lead: ['Product Director', 'Group Product Manager', 'Lead Product Manager'],
    ic: ['Product Manager', 'Senior Product Manager', 'Associate Product Manager'],
  },
  Consulting: {
    exec: ['Partner', 'Managing Director', 'Principal'],
    lead: ['Engagement Manager', 'Consulting Manager', 'Practice Lead'],
    ic: ['Consultant', 'Senior Consultant', 'Associate Consultant'],
  },
  'Customer Success and Support': {
    exec: ['VP Customer Success', 'Chief Customer Officer', 'Head of Customer Success'],
    lead: ['Customer Success Director', 'Customer Success Manager', 'Head of Support'],
    ic: ['Customer Success Manager', 'Onboarding Specialist', 'Support Engineer'],
  },
  Entrepreneurship: {
    exec: ['Founder', 'Co-Founder', 'Owner', 'CEO', 'Managing Director'],
    lead: ['General Manager', 'Managing Partner'],
    ic: ['Founder', 'Solopreneur'],
  },
};

// A safe fallback when a selected function has no curated suggestions yet.
// Builds COMPLETE, real titles from the function label + seniority (never bare
// fragments like 'VP' or 'Head of'), so any of the 26 functions gets sensible
// one-click suggestions. E.g. function 'Legal' + exec bucket -> 'VP Legal',
// 'Head of Legal', 'Chief Legal Officer'.
export function genericTitlesForFunction(fn: string, bucket: SeniorityBucket): string[] {
  if (bucket === 'exec') return [`VP ${fn}`, `Head of ${fn}`, `Director of ${fn}`];
  if (bucket === 'lead') return [`${fn} Director`, `${fn} Manager`, `Head of ${fn}`];
  return [`${fn} Manager`, `${fn} Specialist`, `${fn} Lead`];
}
