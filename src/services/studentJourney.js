export async function getCompletedStudentWorkshops(
  studentId,
  {
    queryDocuments,
    readDocument,
  }
) {
  if (
    typeof studentId !== "string" ||
    !studentId.trim()
  ) {
    throw new Error("A student ID is required to load completed workshops.");
  }

  if (
    typeof queryDocuments !== "function" ||
    typeof readDocument !== "function"
  ) {
    throw new Error("Cosmos query and document readers are required.");
  }

  const registrations = await queryDocuments(
    "registrations",
    `
      SELECT *
      FROM c
      WHERE c.studentId = @studentId AND c.status = @status
    `,
    [
      {
        name: "@studentId",
        value: studentId,
      },
      {
        name: "@status",
        value: "completed",
      },
    ]
  );

  const workshopResults = await Promise.all(
    registrations.map((registration) =>
      registration.workshopId
        ? readDocument("workshops", registration.workshopId)
        : null
    )
  );

  return workshopResults
    .filter(Boolean)
    .map((workshop) => ({
      id: workshop.id,
      ...workshop,
    }));
}
