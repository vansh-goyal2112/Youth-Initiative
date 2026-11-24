import { textIncludesTerm } from "../services/saitProgramNormalization.js";

// These are discovery interests, separate from the catalogue's program areas and grade filters.
const schoolTerms = {
  Energy: ["energy", "petroleum", "oil and gas", "power engineering", "solar", "renewable energy"],
  Health: ["health", "healthcare", "medical", "health care", "paramedic", "sonography", "ultrasound", "dental", "pharmacy", "nursing", "respiratory therapy"],
  "Public Safety": ["public safety", "forensics", "forensic", "firefighter", "firefighting", "law enforcement", "emergency management", "emergency response"],
  Technology: ["technology", "coding", "programming", "software", "artificial intelligence", "ai", "machine learning", "cybersecurity", "cyber security", "computer science", "information systems", "extended reality", "virtual reality", "augmented reality", "data science", "network systems"],
  Business: ["business", "accounting", "finance", "investment", "marketing", "entrepreneurship", "human resources"],
  Construction: ["construction", "carpentry", "carpenter", "plumbing", "plumber", "architectural", "bricklayer", "electrician"],
  Culinary: ["culinary", "baking", "cooking", "chef", "baker", "pastry", "butchery"],
  Hospitality: ["hospitality", "hotel", "lodging", "restaurant management"],
  Tourism: ["tourism", "travel management", "tour operator"],
  Manufacturing: ["manufacturing", "machining", "machinist", "welding", "welder", "metal fabrication", "3d printing"],
  Automation: ["automation", "robotics", "mechatronics", "instrumentation", "industrial controls"],
  Transportation: ["transportation", "aviation", "automotive", "aircraft", "avionics", "locomotive", "heavy equipment technician", "automotive service"],
};

export const schoolInterests = Object.keys(schoolTerms);
export const schoolInterestIds = schoolInterests.map(label => label.toLowerCase());
export const legacyInterests = ["Coding", "Artificial Intelligence", "Robotics", "Skilled Trades", "Design", "Aviation"];
export const acceptedInterestLabels = [...schoolInterests, ...legacyInterests];
export const acceptedInterestIds = acceptedInterestLabels.map(label => label.toLowerCase());

export function interestChoices(saved = []) {
  return [...schoolInterests, ...legacyInterests.filter(label => saved.includes(label.toLowerCase()))];
}

export function inferSchoolInterests(text) {
  const matches = schoolInterests.filter(label => schoolTerms[label].some(term => textIncludesTerm(text, term)));
  // A credential such as Medical Laboratory Technology belongs under Health.
  if (matches.length > 1 && !schoolTerms.Technology.some(term => term !== "technology" && textIncludesTerm(text, term))) {
    return matches.filter(label => label !== "Technology");
  }
  return matches;
}

export function experienceSchools(workshop) {
  const tags = Array.isArray(workshop.interestTags) ? workshop.interestTags : [];
  const explicit = schoolInterests.filter(label => tags.some(tag => textIncludesTermExact(tag, label)));
  const legacy = inferSchoolInterests(tags.filter(tag => legacyInterests.some(label => textIncludesTermExact(tag, label))).join(" "));
  if (explicit.length) return [...new Set([...explicit, ...legacy])];
  const fromTitle = inferSchoolInterests(workshop.title);
  if (fromTitle.length || legacy.length) return [...new Set([...fromTitle, ...legacy])];
  // Broad legacy tags such as Skilled Trades need specific evidence before assigning a school.
  const fromDescription = inferSchoolInterests(workshop.description);
  if (fromDescription.length) return fromDescription;
  return schoolInterests.filter(label => textIncludesTermExact(workshop.category, label));
}

function textIncludesTermExact(value, label) {
  return typeof value === "string" && value.trim().toLowerCase() === label.toLowerCase();
}

export function legacyTagMatches(interest, workshop, tags, schools) {
  if (tags.includes(interest)) return true;
  // An older student's specific interest still needs topic evidence on newly tagged experiences.
  const relevantSchools = inferSchoolInterests(interest);
  return relevantSchools.some(school => schools.includes(school.toLowerCase())) &&
    textIncludesTerm(workshop.title, interest);
}
