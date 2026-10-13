const PROGRAM_CATEGORIES = [
  {
    category: "Technology",
    terms: [
      "artificial intelligence",
      "coding",
      "computer science",
      "cybersecurity",
      "data science",
      "digital",
      "information technology",
      "programming",
      "robotics",
      "software",
      "technology",
    ],
  },
  {
    category: "Trades",
    terms: [
      "carpentry",
      "cabinetmaker",
      "construction",
      "electrician",
      "heavy equipment",
      "machining",
      "machinist",
      "millwright",
      "plumbing",
      "refrigeration",
      "trades",
      "welding",
    ],
  },
  {
    category: "Business & Leadership",
    terms: [
      "accounting",
      "business",
      "entrepreneurship",
      "finance",
      "leadership",
      "management",
      "marketing",
    ],
  },
  {
    category: "Culinary & Hospitality",
    terms: [
      "baking",
      "culinary",
      "food",
      "hospitality",
      "tourism",
    ],
  },
  {
    category: "Design & Creativity",
    terms: [
      "creative",
      "design",
      "fashion",
      "film",
      "media",
    ],
  },
  {
    category: "Health",
    terms: [
      "health",
      "healthcare",
      "medical",
      "nursing",
      "paramedic",
      "pharmacy",
    ],
  },
  {
    category: "Aviation",
    terms: [
      "aviation",
      "aircraft",
      "pilot",
    ],
  },
];

const WORKSHOP_CATEGORIES = new Set([
  "Technology",
  "Trades",
  "Business & Leadership",
  "Culinary & Hospitality",
  "Design & Creativity",
]);

const PROGRAM_TOPICS = [
  {
    label: "Artificial Intelligence",
    terms: ["artificial intelligence"],
    subjects: ["Computer Science"],
    skills: ["Artificial Intelligence"],
  },
  {
    label: "Aviation",
    terms: ["aviation", "aircraft", "pilot"],
    subjects: ["Aviation"],
    skills: ["Aviation"],
  },
  {
    label: "Baking",
    terms: ["baking"],
    subjects: ["Culinary Arts"],
    skills: ["Baking"],
  },
  {
    label: "Business",
    terms: ["business"],
    subjects: ["Business"],
    skills: ["Business"],
  },
  {
    label: "Carpentry",
    terms: ["carpentry"],
    subjects: ["Construction"],
    skills: ["Carpentry"],
  },
  {
    label: "Coding",
    terms: ["coding", "programming", "software development"],
    subjects: ["Computer Science", "Programming"],
    skills: ["Programming", "Software Development"],
  },
  {
    label: "Cybersecurity",
    terms: ["cybersecurity", "cyber security"],
    subjects: ["Computer Science"],
    skills: ["Cybersecurity"],
  },
  {
    label: "Data Analysis",
    terms: ["data analysis", "data analytics"],
    subjects: ["Data Science", "Mathematics"],
    skills: ["Data Analysis"],
  },
  {
    label: "Design",
    terms: ["design"],
    subjects: ["Design"],
    skills: ["Design"],
  },
  {
    label: "Health",
    terms: ["health", "nursing", "paramedic", "pharmacy"],
    subjects: ["Health"],
    skills: [],
  },
  {
    label: "Leadership",
    terms: ["leadership"],
    subjects: ["Business"],
    skills: ["Leadership"],
  },
  {
    label: "Mathematics",
    terms: ["mathematics", "math"],
    subjects: ["Mathematics"],
    skills: [],
  },
  {
    label: "Robotics",
    terms: ["robotics"],
    subjects: ["Computer Science", "Engineering"],
    skills: ["Robotics"],
  },
  {
    label: "Software Development",
    terms: ["software development"],
    subjects: ["Computer Science", "Programming"],
    skills: ["Software Development"],
  },
  {
    label: "Welding",
    terms: ["welding"],
    subjects: ["Trades"],
    skills: ["Welding"],
  },
];

const VALID_CREDENTIALS = [
  "Applied Degree",
  "Bachelor of Applied Technology",
  "Bachelor of Business Administration",
  "Bachelor of Science",
  "Post-diploma Certificate",
  "Post-graduate Certificate",
  "Certificate",
  "Degree",
  "Diploma",
  "Journeyperson",
];

const PROGRAM_FIELDS = new Set([
  "id",
  "title",
  "description",
  "programArea",
  "credential",
  "informationUrl",
  "category",
  "skills",
  "subjects",
  "careerAreas",
  "learningMode",
  "location",
  "duration",
  "admissionRequirements",
  "relatedWorkshopCategories",
  "relatedWorkshopTopics",
  "source",
  "status",
  "createdAt",
  "updatedAt",
]);

export function normalizeMatchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function textIncludesTerm(text, term) {
  const normalizedText = ` ${normalizeMatchText(text)} `;
  const normalizedTerm = normalizeMatchText(term);

  return Boolean(
    normalizedTerm &&
      normalizedText.includes(` ${normalizedTerm} `)
  );
}

export function createSaitProgramId(title) {
  return normalizeMatchText(title).replace(/\s/g, "-");
}

function findCategory(text) {
  const categoryMatch = PROGRAM_CATEGORIES.find(
    ({ terms }) =>
      terms.some((term) => textIncludesTerm(text, term))
  );

  return categoryMatch?.category || "General";
}

export function findSaitCategory(text) {
  return findCategory(text);
}

function findCredential(text) {
  const normalizedText = normalizeMatchText(text);

  return (
    VALID_CREDENTIALS.find((credential) =>
      normalizedText.includes(normalizeMatchText(credential))
    ) || null
  );
}

function findLearningMode(text) {
  const normalizedText = normalizeMatchText(text);
  const mentionsOnline =
    /\b(online|distance learning|distance delivery)\b/.test(normalizedText);
  const mentionsInPerson =
    /\b(in person|on campus|classroom delivery)\b/.test(normalizedText);

  if (mentionsOnline && mentionsInPerson) {
    return "hybrid";
  }

  if (mentionsOnline) {
    return "online";
  }

  if (mentionsInPerson) {
    return "in-person";
  }

  return null;
}

function findDuration(text) {
  const match = text.match(
    /\b(?:duration|program length)\s*:?\s*([^.!?|\n]{1,80})/i
  );

  return match?.[1]?.trim() || null;
}

function getMatchedTopics(text) {
  return PROGRAM_TOPICS.filter(({ terms }) =>
    terms.some((term) => textIncludesTerm(text, term))
  );
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  if (value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must contain only strings.`);
  }

  return unique(
    value
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function isOfficialSaitUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "sait.ca" ||
        url.hostname.endsWith(".sait.ca"))
    );
  } catch {
    return false;
  }
}

export function normalizeSaitProgram(rawProgram, now = new Date()) {
  if (!rawProgram || typeof rawProgram !== "object") {
    throw new Error("A raw SAIT program object is required.");
  }

  const title = String(rawProgram.title || "").trim();
  const description = String(rawProgram.description || "").trim();
  const informationUrl = String(
    rawProgram.informationUrl || ""
  ).trim();

  if (!title) {
    throw new Error("The SAIT program title is required.");
  }

  if (!isOfficialSaitUrl(informationUrl)) {
    throw new Error(
      "The SAIT program information URL must use the official sait.ca domain."
    );
  }

  const sourceText =
    typeof rawProgram.sourceText === "string"
      ? rawProgram.sourceText
      : "";
  const evidenceText = `${title} ${description} ${sourceText}`;
  const category = findCategory(evidenceText);
  const matchedTopics = getMatchedTopics(evidenceText);
  const timestamp =
    typeof now === "function" ? now().toISOString() : now.toISOString();
  const explicitStatus = ["active", "inactive"].includes(
    rawProgram.status
  )
    ? rawProgram.status
    : "active";

  return {
    id: createSaitProgramId(title),
    title,
    description,
    programArea:
      typeof rawProgram.programArea === "string"
        ? rawProgram.programArea.trim() || null
        : null,
    credential:
      typeof rawProgram.credential === "string" &&
      rawProgram.credential.trim()
        ? findCredential(rawProgram.credential) ||
          rawProgram.credential.trim()
        : findCredential(evidenceText),
    informationUrl,
    category,
    skills: unique([
      ...matchedTopics.flatMap(({ skills }) => skills),
      ...normalizeStringArray(rawProgram.skills || [], "skills"),
    ]),
    subjects: unique([
      ...matchedTopics.flatMap(({ subjects }) => subjects),
      ...normalizeStringArray(rawProgram.subjects || [], "subjects"),
    ]),
    careerAreas: normalizeStringArray(
      rawProgram.careerAreas || [],
      "careerAreas"
    ),
    learningMode:
      ["in-person", "online", "hybrid"].includes(
        rawProgram.learningMode
      )
        ? rawProgram.learningMode
        : findLearningMode(evidenceText),
    location:
      typeof rawProgram.location === "string"
        ? rawProgram.location.trim() || null
        : null,
    duration:
      typeof rawProgram.duration === "string"
        ? rawProgram.duration.trim() || null
        : findDuration(sourceText || description),
    admissionRequirements: normalizeStringArray(
      rawProgram.admissionRequirements || [],
      "admissionRequirements"
    ),
    relatedWorkshopCategories: WORKSHOP_CATEGORIES.has(category)
      ? [category]
      : [],
    relatedWorkshopTopics: unique([
      ...matchedTopics.map(({ label }) => label),
      ...normalizeStringArray(
        rawProgram.relatedWorkshopTopics || [],
        "relatedWorkshopTopics"
      ),
    ]),
    source: "SAIT",
    status: explicitStatus,
    createdAt:
      typeof rawProgram.createdAt === "string"
        ? rawProgram.createdAt
        : timestamp,
    updatedAt: timestamp,
  };
}

export function validateSaitProgram(program) {
  const errors = [];

  if (!program || typeof program !== "object" || Array.isArray(program)) {
    return {
      valid: false,
      errors: ["A SAIT program record must be an object."],
    };
  }

  for (const field of Object.keys(program)) {
    if (!PROGRAM_FIELDS.has(field)) {
      errors.push(`Unexpected field: ${field}.`);
    }
  }

  for (const field of [
    "id",
    "title",
    "description",
    "informationUrl",
    "category",
    "source",
    "status",
    "createdAt",
    "updatedAt",
  ]) {
    if (typeof program[field] !== "string" || !program[field].trim()) {
      errors.push(`${field} must be a non-empty string.`);
    }
  }

  if (
    typeof program.title === "string" &&
    program.id !== createSaitProgramId(program.title)
  ) {
    errors.push("id must be the deterministic slug of title.");
  }

  if (
    typeof program.informationUrl === "string" &&
    !isOfficialSaitUrl(program.informationUrl)
  ) {
    errors.push("informationUrl must use the official sait.ca domain.");
  }

  for (const field of [
    "skills",
    "subjects",
    "careerAreas",
    "admissionRequirements",
    "relatedWorkshopCategories",
    "relatedWorkshopTopics",
  ]) {
    if (
      !Array.isArray(program[field]) ||
      program[field].some(
        (item) => typeof item !== "string" || !item.trim()
      )
    ) {
      errors.push(`${field} must be an array of non-empty strings.`);
    }
  }

  for (const field of [
    "programArea",
    "credential",
    "location",
    "duration",
    "learningMode",
  ]) {
    if (
      program[field] !== null &&
      typeof program[field] !== "string"
    ) {
      errors.push(`${field} must be a string or null.`);
    }
  }

  if (
    !["in-person", "online", "hybrid", null].includes(
      program.learningMode
    )
  ) {
    errors.push("learningMode must be in-person, online, hybrid, or null.");
  }

  if (!["active", "inactive"].includes(program.status)) {
    errors.push("status must be active or inactive.");
  }

  if (program.source !== "SAIT") {
    errors.push('source must be "SAIT".');
  }

  for (const field of ["createdAt", "updatedAt"]) {
    if (
      typeof program[field] === "string" &&
      Number.isNaN(Date.parse(program[field]))
    ) {
      errors.push(`${field} must be a valid timestamp.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidSaitProgram(program) {
  const validation = validateSaitProgram(program);

  if (!validation.valid) {
    throw new Error(
      `Invalid SAIT program ${program?.id || "(unknown)"}: ${validation.errors.join(" ")}`
    );
  }

  return program;
}

function recordCompleteness(program) {
  return [
    "description",
    "programArea",
    "credential",
    "learningMode",
    "location",
    "duration",
  ].filter((field) => Boolean(program[field])).length +
    String(program.description || "").trim().length +
    [
      "skills",
      "subjects",
      "careerAreas",
      "admissionRequirements",
      "relatedWorkshopCategories",
      "relatedWorkshopTopics",
    ].reduce(
      (total, field) => total + (program[field]?.length || 0),
      0
    );
}

export function deduplicateSaitPrograms(programs) {
  if (!Array.isArray(programs)) {
    throw new Error("SAIT programs must be provided as an array.");
  }

  const programsById = new Map();

  for (const program of programs) {
    assertValidSaitProgram(program);
    const current = programsById.get(program.id);

    if (
      !current ||
      recordCompleteness(program) > recordCompleteness(current) ||
      (recordCompleteness(program) === recordCompleteness(current) &&
        program.informationUrl.localeCompare(current.informationUrl) < 0)
    ) {
      programsById.set(program.id, program);
    }
  }

  return [...programsById.values()].sort((first, second) =>
    first.id.localeCompare(second.id)
  );
}
