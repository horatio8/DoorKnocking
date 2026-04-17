// Canonical platform voter schema and mapping helpers.

export interface PlatformField {
  key: string;                     // column on public.voters or derived
  label: string;
  required: boolean;
  description: string;
  group: "identity" | "name" | "address" | "contact" | "party" | "metadata";
}

export const PLATFORM_FIELDS: PlatformField[] = [
  { key: "airtable_voter_key", label: "Voter key (unique row ID)", required: true,
    group: "identity", description: "A unique, stable identifier for this voter row in the source. Often a state voter ID or a custom voter key." },
  { key: "household_rec_id", label: "Household ID", required: true,
    group: "identity", description: "Identifier shared by everyone at the same address. If absent we fall back to a hash of the address." },
  { key: "state_voter_id", label: "State voter ID", required: false,
    group: "identity", description: "Government-issued voter registration ID." },
  { key: "client_id", label: "Client / external ID", required: false,
    group: "identity", description: "Any other ID the client uses to track this voter." },
  { key: "first_name", label: "First name", required: true, group: "name", description: "" },
  { key: "middle_name", label: "Middle name", required: false, group: "name", description: "" },
  { key: "last_name", label: "Last name", required: true, group: "name", description: "" },
  { key: "suffix", label: "Suffix (Jr, Sr, III…)", required: false, group: "name", description: "" },
  { key: "address_line1", label: "Street address", required: true, group: "address",
    description: "Number + street name. Unit goes in 'Unit' instead." },
  { key: "unit", label: "Apartment / unit", required: false, group: "address", description: "" },
  { key: "city", label: "City", required: true, group: "address", description: "" },
  { key: "state", label: "State / region", required: true, group: "address",
    description: "2-letter state code in the US, full electorate name in AU." },
  { key: "zip", label: "ZIP / postcode", required: true, group: "address", description: "" },
  { key: "zip4", label: "ZIP+4", required: false, group: "address", description: "" },
  { key: "lat", label: "Latitude", required: false, group: "address",
    description: "Pre-geocoded; if absent we will geocode via Mapbox." },
  { key: "lng", label: "Longitude", required: false, group: "address",
    description: "Pre-geocoded; if absent we will geocode via Mapbox." },
  { key: "neighborhood_id", label: "Neighborhood / precinct", required: false,
    group: "address", description: "" },
  { key: "primary_phone", label: "Primary phone", required: false, group: "contact", description: "" },
  { key: "household_party", label: "Household party", required: false, group: "party",
    description: "Aggregate party of the household (e.g. R, D, I, MIXED)." },
  { key: "observed_party", label: "Observed party", required: false, group: "party",
    description: "Party observed at the door from prior canvassing." },
  { key: "official_party", label: "Official party", required: false, group: "party",
    description: "Party of record from the voter file." },
  { key: "calculated_party", label: "Calculated party", required: false, group: "party",
    description: "Party score from a model (e.g. R, D, I, persuadable)." },
  { key: "moved", label: "Moved away", required: false, group: "metadata",
    description: "Boolean; true if this voter is no longer at this address." },
];

export type FieldMapping = Record<string, string | null>;
// e.g. { "first_name": "FirstName", "address_line1": "PrimaryAddress1", ... }

export interface MappingProposal {
  mapping: FieldMapping;
  confidence: Record<string, "high" | "medium" | "low">;
  reasoning: Record<string, string>;
  unmapped_airtable_fields: string[];
  warnings: string[];
}
