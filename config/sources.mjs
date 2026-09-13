/**
 * Rental Finder 26 — Nottinghamshire source registry.
 *
 * These are public rental-index / branch pages that expose current rental
 * inventory on their own domains. The connector is deliberately conservative:
 * it performs ordinary HTTP GETs, does not bypass anti-bot controls, and treats
 * 403/429/timeouts as source failures rather than evidence that a property was
 * removed.
 *
 * IMPORTANT: website terms and robots policies can change. Re-check them
 * periodically and disable any source that no longer permits automated access.
 */
export const SOURCES = [
  {
    id: "fhp-living",
    label: "FHP Living",
    type: "page",
    url: "https://fhpliving.co.uk/rent/",
    enabled: true,
  },
  {
    id: "robert-ellis",
    label: "Robert Ellis",
    type: "page",
    url: "https://www.robertellis.co.uk/properties/to-rent/",
    enabled: true,
  },
  {
    id: "rex-gooding",
    label: "Rex Gooding",
    type: "page",
    url: "https://rexgooding.com/tenants",
    enabled: true,
  },
  {
    id: "cp-walker",
    label: "CP Walker & Son",
    type: "page",
    url: "https://www.cpwalker.co.uk/nottinghamshire/lettings/",
    enabled: true,
  },
  {
    id: "walton-allen",
    label: "Walton & Allen",
    type: "page",
    url: "https://www.waltonandallen.co.uk/properties-to-rent/",
    enabled: true,
  },
  {
    id: "holden-copley",
    label: "HoldenCopley",
    type: "page",
    url: "https://www.holdencopley.co.uk/property-to-rent-in-nottingham/",
    enabled: true,
  },
  {
    id: "hammond-property-services",
    label: "Hammond Property Services",
    type: "page",
    url: "https://www.hammondpropertyservices.com/property-search/for-letting/in-nottinghamshire/",
    enabled: true,
  },
  {
    id: "richard-watkinson",
    label: "Richard Watkinson & Partners",
    type: "page",
    url: "https://www.richardwatkinson.co.uk/properties/lettings",
    enabled: true,
  },
  {
    id: "martin-co-nottingham",
    label: "Martin & Co Nottingham City",
    type: "page",
    url: "https://www.martinco.com/estate-agents-and-letting-agents/branch/nottingham-city/",
    enabled: true,
  },
  {
    id: "martin-co-hucknall",
    label: "Martin & Co Hucknall",
    type: "page",
    url: "https://www.martinco.com/estate-agents-and-letting-agents/branch/hucknall/",
    enabled: true,
  },
  {
    id: "martin-co-mansfield",
    label: "Martin & Co Mansfield",
    type: "page",
    url: "https://www.martinco.com/estate-agents-and-letting-agents/branch/mansfield/",
    enabled: true,
  },
  {
    id: "whitegates-nottingham-sherwood",
    label: "Whitegates Nottingham Sherwood",
    type: "page",
    url: "https://www.whitegates.co.uk/estate-agents-and-letting-agents/branch/nottingham-sherwood/",
    enabled: true,
  },
  {
    id: "whitegates-beeston",
    label: "Whitegates Beeston",
    type: "page",
    url: "https://www.whitegates.co.uk/estate-agents-and-letting-agents/branch/beeston/",
    enabled: true,
  },
  {
    id: "whitegates-newark",
    label: "Whitegates Newark",
    type: "page",
    url: "https://www.whitegates.co.uk/estate-agents-and-letting-agents/branch/newark/",
    enabled: true,
  },
  {
    id: "whitegates-mansfield",
    label: "Whitegates Mansfield",
    type: "page",
    url: "https://www.whitegates.co.uk/estate-agents-and-letting-agents/branch/mansfield/",
    enabled: true,
  },
  {
    id: "belvoir-nottingham-central",
    label: "Belvoir Nottingham Central",
    type: "page",
    url: "https://www.belvoir.co.uk/estate-agents-and-letting-agents/branch/nottingham-central/property-to-rent/",
    enabled: true,
  },
  {
    id: "belvoir-nottingham-west",
    label: "Belvoir Nottingham West",
    type: "page",
    url: "https://www.belvoir.co.uk/estate-agents-and-letting-agents/branch/nottingham-west/property-to-rent/",
    enabled: true,
  },
  {
    id: "belvoir-west-bridgford",
    label: "Belvoir West Bridgford",
    type: "page",
    url: "https://www.belvoir.co.uk/estate-agents-and-letting-agents/branch/west-bridgford/property-to-rent/",
    enabled: true,
  },
  {
    id: "belvoir-mansfield",
    label: "Belvoir Mansfield",
    type: "page",
    url: "https://www.belvoir.co.uk/estate-agents-and-letting-agents/branch/mansfield/property-to-rent/",
    enabled: true,
  },
  {
    id: "leaders-nottinghamshire",
    label: "Leaders Nottinghamshire",
    type: "page",
    url: "https://www.leaders.co.uk/properties/to-rent/in-nottinghamshire/",
    enabled: true,
  },
  {
    id: "william-h-brown-nottinghamshire",
    label: "William H Brown Nottinghamshire",
    type: "page",
    url: "https://www.williamhbrown.co.uk/nottinghamshire/lettings",
    enabled: true,
  },
  {
    id: "frank-innes-nottingham",
    label: "Frank Innes Nottingham",
    type: "page",
    url: "https://www.frankinnes.co.uk/branch/estate-agents/nottingham/lettings",
    enabled: true,
  },
  {
    id: "haart-nottingham",
    label: "haart Nottingham",
    type: "page",
    url: "https://www.haart.co.uk/branch-finder/nottingham-estate-agents/",
    enabled: true,
  },
];
