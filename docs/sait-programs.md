# SAIT Program Pathways

SAIT post-secondary programs are stored independently from youth workshops in
the Azure Cosmos DB `saitPrograms` container. This feature uses the existing
`src/services/cosmos.js` connection and does not change the workshop schema or
Firebase workshop storage.

## Document schema

Each document contains only application-owned properties:

```json
{
  "id": "software-development-diploma",
  "title": "Software Development Diploma",
  "description": "Official description from the SAIT page.",
  "programArea": null,
  "credential": "Diploma",
  "informationUrl": "https://www.sait.ca/programs-and-courses/diplomas/software-development",
  "category": "Technology",
  "skills": ["Programming", "Software Development"],
  "subjects": ["Computer Science", "Programming"],
  "careerAreas": [],
  "learningMode": null,
  "location": null,
  "duration": null,
  "admissionRequirements": [],
  "relatedWorkshopCategories": ["Technology"],
  "relatedWorkshopTopics": ["Coding", "Software Development"],
  "source": "SAIT",
  "status": "active",
  "createdAt": "2026-10-07T00:00:00.000Z",
  "updatedAt": "2026-10-07T00:00:00.000Z"
}
```

Unknown source facts remain `null` or empty arrays. Areas and career outcomes
are not inferred. The normalizer creates subject, skill, and workshop topic
tags only when corresponding terminology occurs in the official program title
or description. The category taxonomy is shared with the categories currently
assigned to workshops by the existing Excel import flow.

`title`, `description`, `programArea`, `credential`, `informationUrl`,
`learningMode`, `location`, and `duration` are extracted from the official SAIT
page when present. `category`, `skills`, `subjects`,
`relatedWorkshopCategories`, and `relatedWorkshopTopics` are recommendation
tags derived from the page's title and description; they are not claims that
SAIT publishes those classifications. Empty or unknown source facts are not
filled with inferred admission or career information. `careerAreas` and
`admissionRequirements` remain empty because this scraper does not extract
those facts.

## Cosmos setup and environment

No pathways/program container was present in the repository. Provision one
container named `saitPrograms` in the database configured by the existing
Cosmos service, with `/id` as its partition key. The service deliberately does
not create containers automatically. It upserts deterministic title-slug IDs
and carries forward an existing document's `createdAt`.

The existing configuration is required:

- `COSMOS_ENDPOINT`
- `COSMOS_DATABASE_NAME` (optional; defaults to `YouthInitiative`)
- `COSMOS_KEY` (optional; key-based authentication, if configured)
- `AZURE_MANAGED_IDENTITY_CLIENT_ID` in production when using the configured
  user-assigned managed identity
- Local runs use `DefaultAzureCredential` (for example, an authenticated Azure
  CLI session). Prefer identity-based access over storing a Cosmos key.

## Scraper

The scraper starts at the official
[SAIT programs and courses listing](https://www.sait.ca/programs-and-courses).
Because SAIT renders its program search results client-side, the crawler falls
back to SAIT's [official sitemap index](https://www.sait.ca/sitemap/sitemap-index.xml)
and [program sitemap](https://www.sait.ca/sitemap/index/sitemap-sait.xml) when
the listing HTML has no program links. It follows only official `sait.ca` pages
under the program credential paths (degrees, diplomas, certificates, and
pre-employment), reads the public program title, description, and labeled
credential details, normalizes and validates records, deduplicates by
deterministic ID, and upserts them. All pages are fetched and normalized before
any writes start, so a crawl or parse error does not begin a partial import.
Cosmos write failures are reported; Cosmos may have accepted earlier upserts
before a later write fails.

```powershell
npm run scrape:sait-programs
```

Run it from the project directory with Node.js 22.7 or newer. The command
requires the Cosmos configuration above and Azure credentials with permission
to read and write the `saitPrograms` container. It exits with an error on any
scraper request, parse, or persistence failure. Cosmos may have accepted
earlier writes when a later persistence operation fails.

## Recommendation scoring

`src/services/saitProgramRecommendations.js` implements an explainable,
rule-based score, with default weights totaling 100:

| Evidence | Weight |
| --- | ---: |
| Student interest mapped to program category | 25 |
| Student interest mapped to program subjects | 15 |
| Completed workshop category matches related categories | 20 |
| Completed workshop title, description, subject, or skill matches a related topic | 25 |
| Saved learning preference matches published delivery mode | 15 |

The exported `PROGRAM_RECOMMENDATION_WEIGHTS` can be passed as an override to
`recommendSaitPrograms`; each weight must be a non-negative finite number.
Recommendations without a positive evidence match are omitted. Reasons are
generated from the same matching fields used for scoring.

The current student model stores `interests` and `learningMode`. Completed
workshops are read from the Cosmos `registrations` container with
`status == "completed"` and joined to the existing `workshops` documents. The
repository does not currently store student career goals or a separate
learning-journey skills list, so those are not used as recommendation signals.

Workshop recommendations are not currently returned. Student grade is not
stored, so youth workshop grade eligibility cannot be verified safely. Grade
is not inferred from date of birth; the recommendation API only returns
possible post-secondary program pathways until a verified grade source exists.

The authenticated endpoint is `GET /api/pathways/recommendations`. It returns
possible future pathways with scores and evidence-based reasons; it does not
claim admission eligibility, guaranteed admission, or employment outcomes.

## Workshop relationships

The program normalizer assigns a category from recognized terms in official
program text and places that category in `relatedWorkshopCategories` so it can
match an existing workshop category emitted by the workshop import flow. It
does not link a program category to the unrelated `General` fallback when no
workshop category aligns. It also extracts controlled topic, subject, and
skill labels only when source text contains their terms. On the recommendation
endpoint, completed workshop categories, titles, descriptions, and any
available subject/topic/skill tags are compared against those program fields.
A category/topic reason is only returned when that corresponding match
contributes to the recommendation.

Focused unit tests can be run with:

```powershell
npm test
```

The Azure deployment workflow runs this test suite and lint. It does not scrape
SAIT pages or write to Cosmos DB; ingestion remains a controlled, manually run
operation requiring Cosmos data-plane permissions.

## Ingestion command (workshops + programs)

```powershell
npm run ingest:sait -- --dry-run --output tmp/review.json   # review only, no Azure access
npm run ingest:sait                                         # upload to Cosmos DB
```

Options: `--only programs|workshops`, `--limit <n>`, `--output <file>`. It is
not part of CI/CD. Workshops go to the existing `workshops` container (same
schema and ID convention as the Excel import); programs go to `saitPrograms`.
Partition keys are read from each container's definition. A scraped workshop
whose official page is already stored under another ID is left untouched, and
an existing ID has its scraped details refreshed while app-owned fields such
as XP reward and status are preserved. A failed workshop page or invalid record
prevents writes for that dataset so a partial scrape is not uploaded.

Workshop discovery uses SAIT's official Youth sitemap, the Youth Programs
catalog, and the public search data that powers the summer-camp listing. It
includes individual Summer Camps and Dual Credit courses/programs, Digital
Youth topics and workshop offerings, and other workshop-related Youth Program
pages. It records published grade and age ranges where available, along with
the official title, description, delivery and location when labeled, dates,
image, and source/registration links. Camps whose sessions are all closed stay
visible as reference listings with a "Registration closed" notice; the app
does not offer its registration or confirmation controls. Educator-only pages
are not shown to students.

Students may set their current school grade during registration or in profile
settings. The student workshop API hides offerings whose known age or grade
requirements do not match the student's profile, and the registration API
checks the same rules. When the source omits requirements or the student's
grade is not known, the offering remains visible with an eligibility notice
and a link to SAIT for confirmation. The report lists discovered, validated,
inserted, updated, unchanged, already present, skipped and failed counts; exit
code is 1 on any failure and 2 on bad setup.
The command needs `COSMOS_ENDPOINT` and an identity with the Cosmos DB data
role (e.g. "Cosmos DB Built-in Data Contributor") on the account.
