import {
  getCosmosContainer,
} from "./cosmos.js";
import {
  assertValidSaitProgram,
  deduplicateSaitPrograms,
} from "./saitProgramNormalization.js";

export const SAIT_PROGRAMS_CONTAINER = "saitPrograms";

function isNotFoundError(error) {
  return error?.code === 404 || error?.statusCode === 404;
}

export async function upsertSaitPrograms(
  programs,
  {
    container = getCosmosContainer(SAIT_PROGRAMS_CONTAINER),
    now = () => new Date(),
  } = {}
) {
  const uniquePrograms = deduplicateSaitPrograms(programs);
  const savedPrograms = [];

  for (const program of uniquePrograms) {
    assertValidSaitProgram(program);

    let existingProgram = null;
    try {
      const response = await container
        .item(program.id, program.id)
        .read();
      existingProgram = response.resource || null;
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    const record = {
      ...program,
      createdAt:
        existingProgram?.createdAt || program.createdAt,
      updatedAt: now().toISOString(),
    };

    assertValidSaitProgram(record);
    await container.items.upsert(record);
    savedPrograms.push(record);
  }

  return savedPrograms;
}

export async function getActiveSaitPrograms({
  container = getCosmosContainer(SAIT_PROGRAMS_CONTAINER),
} = {}) {
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.status = @status",
      parameters: [
        {
          name: "@status",
          value: "active",
        },
      ],
    })
    .fetchAll();

  return resources
    .map((program) => ({
      id: program.id,
      title: program.title,
      description: program.description,
      programArea: program.programArea ?? null,
      credential: program.credential ?? null,
      informationUrl: program.informationUrl,
      category: program.category,
      skills: program.skills || [],
      subjects: program.subjects || [],
      careerAreas: program.careerAreas || [],
      learningMode: program.learningMode ?? null,
      location: program.location ?? null,
      duration: program.duration ?? null,
      admissionRequirements: program.admissionRequirements || [],
      relatedWorkshopCategories:
        program.relatedWorkshopCategories || [],
      relatedWorkshopTopics: program.relatedWorkshopTopics || [],
      source: program.source,
      status: program.status,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    }))
    .map(assertValidSaitProgram);
}
