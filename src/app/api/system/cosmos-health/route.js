import {
  getCosmosContainer,
} from "@/services/cosmos";

export const runtime =
  "nodejs";

export async function GET() {
  try {
    const studentsContainer =
      getCosmosContainer(
        "students"
      );

    const {
      resource,
    } =
      await studentsContainer.read();

    return Response.json(
      {
        success:
          true,

        service:
          "Azure Cosmos DB",

        database:
          process.env
            .COSMOS_DATABASE_NAME ||
          "YouthInitiative",

        container:
          resource?.id ||
          "students",

        authentication:
          process.env.NODE_ENV ===
          "production"
            ? "Azure Managed Identity"
            : "Azure Developer Credential",
      },
      {
        status:
          200,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Cosmos DB health check failed:",
      error
    );

    return Response.json(
      {
        success:
          false,

        service:
          "Azure Cosmos DB",

        message:
          "Cosmos DB connection could not be verified.",
      },
      {
        status:
          503,
      }
    );
  }
}