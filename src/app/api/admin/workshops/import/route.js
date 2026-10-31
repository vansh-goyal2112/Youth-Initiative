import { assignWorkshopImage, workshopImageUsage } from "@/utils/workshopImageAssignment.mjs";
import crypto from "crypto";

import {
  adminAccessResponse,
  requireAdminPermission,
} from "@/services/adminAccess";

import {
  cosmosNow,
  createCosmosDocument,
  isCosmosConflict,
  isCosmosPreconditionFailed,
  readCosmosDocument,
  replaceCosmosDocument,
  queryCosmosDocuments,
} from "@/services/cosmosData";

export const runtime = "nodejs";

function createWorkshopId(
  title,
  programArea,
  offeringYear = ""
) {
  const normalizedText =
    `${programArea}-${title}-${offeringYear}`
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      )
      .slice(
        0,
        80
      );

  const shortHash =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        `${programArea}-${title}-${offeringYear}`
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        8
      );

  return `${normalizedText}-${shortHash}`;
}

function getCategory(
  title,
  programArea,
  description
) {
  const combinedText =
    `${title} ${programArea} ${description}`.toLowerCase();

  if (
    combinedText.includes(
      "coding"
    ) ||
    combinedText.includes(
      "digital"
    ) ||
    combinedText.includes(
      "robot"
    ) ||
    combinedText.includes(
      "artificial intelligence"
    ) ||
    combinedText.includes(
      "3d printing"
    ) ||
    combinedText.includes(
      "cyber"
    )
  ) {
    return "Technology";
  }

  if (
    combinedText.includes(
      "welding"
    ) ||
    combinedText.includes(
      "carpentry"
    ) ||
    combinedText.includes(
      "construction"
    ) ||
    combinedText.includes(
      "trades"
    )
  ) {
    return "Trades";
  }

  if (
    combinedText.includes(
      "business"
    ) ||
    combinedText.includes(
      "leadership"
    ) ||
    combinedText.includes(
      "investment"
    )
  ) {
    return "Business & Leadership";
  }

  if (
    combinedText.includes(
      "culinary"
    ) ||
    combinedText.includes(
      "baking"
    ) ||
    combinedText.includes(
      "hospitality"
    )
  ) {
    return "Culinary & Hospitality";
  }

  if (
    combinedText.includes(
      "design"
    ) ||
    combinedText.includes(
      "creative"
    ) ||
    combinedText.includes(
      "media"
    )
  ) {
    return "Design & Creativity";
  }

  return "General";
}

function buildImportedWorkshop(
  workshop,
  adminUid
) {
  const workshopId =
    createWorkshopId(
      workshop.title,
      workshop.programArea,
      workshop.offeringYear || ""
    );

  const learningMode =
    workshop.programArea
      .toLowerCase()
      .includes(
        "online"
      )
      ? "online"
      : "in-person";

  const timestamp =
    cosmosNow();

  return {
    id:
      workshopId,

    offeringYear: workshop.offeringYear || null,

    title:
      workshop.title.trim(),

    programArea:
      workshop.programArea.trim(),

    category:
      getCategory(
        workshop.title,
        workshop.programArea,
        workshop.description ||
          ""
      ),

    grade:
      workshop.grade.trim(),

    description:
      workshop.description
        ?.trim() ||
      "",

    informationUrl:
      workshop.informationUrl
        ?.trim() ||
      "",

    registrationUrl:
      "https://saitdigitalyouth.campbrainregistration.com/",

    learningMode,

    startDate:
      null,

    endDate:
      null,

    time:
      "",

    location:
      learningMode ===
      "online"
        ? "Online"
        : "SAIT Campus",

    capacity:
      null,

    xpReward:
      100,

    status:
      "active",

    importedFromExcel:
      true,

    importedBy:
      adminUid,

    updatedAt:
      timestamp,

    createdAt:
      timestamp,
  };
}

async function saveImportedWorkshop(
  workshopData
) {
  /*
    Firestore previously used:

      batch.set(..., { merge: true })

    The equivalent behavior here is:

      - create if missing
      - merge into the existing
        Cosmos document if present

    Retry if another write changes
    the same workshop concurrently.
  */

  for (
    let attempt = 0;
    attempt < 5;
    attempt += 1
  ) {
    const existingWorkshop =
      await readCosmosDocument(
        "workshops",
        workshopData.id
      );

    if (
      !existingWorkshop
    ) {
      try {
        await createCosmosDocument(
          "workshops",
          workshopData
        );

        return;
      } catch (
        error
      ) {
        /*
          Another request may have
          created this deterministic
          workshop ID after our read.

          Retry and merge into it.
        */

        if (
          isCosmosConflict(
            error
          )
        ) {
          continue;
        }

        throw error;
      }
    }

    try {
      await replaceCosmosDocument(
        "workshops",
        existingWorkshop,
        { ...workshopData,
          // Reimports must not erase scheduling, status or manual edits.
          ...existingWorkshop,
          image: existingWorkshop.image === "/images/workshops/50_aviation-bundle.jpg" ? null : (existingWorkshop.image || workshopData.image || null),
          imageAssetId: existingWorkshop.imageAssetId === "photo-50" ? null : (existingWorkshop.imageAssetId || workshopData.imageAssetId || null),
          imageStatus: existingWorkshop.imageAssetId === "photo-50" ? "needs_image" : existingWorkshop.imageAssetId ? "assigned" : existingWorkshop.image && existingWorkshop.image !== "/images/workshops/50_aviation-bundle.jpg" ? "custom" : workshopData.imageStatus,
          createdAt: existingWorkshop.createdAt || workshopData.createdAt,
          updatedAt: cosmosNow(),
        }
      );

      return;
    } catch (
      error
    ) {
      /*
        Another request changed
        this workshop after we read
        it.

        Re-read and retry.
      */

      if (
        isCosmosPreconditionFailed(
          error
        )
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Workshop ${workshopData.id} could not be imported because it was updated concurrently.`
  );
}

export async function POST(
  request
) {
  try {
    const admin =
      await requireAdminPermission(request, "workshops.import");

    const { workshops, mode = "add", preview = false } = await request.json();
    if (!["add", "replace"].includes(mode)) return Response.json({ message: "Invalid import mode." }, { status: 400 });

    if (
      !Array.isArray(
        workshops
      )
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "Workshop data is invalid.",
        },
        {
          status:
            400,
        }
      );
    }

    const validWorkshops =
      workshops.filter(
        (
          workshop
        ) =>
          workshop.title &&
          workshop.programArea &&
          workshop.grade
      );

    if (
      validWorkshops.length ===
      0
    ) {
      return Response.json(
        {
          success:
            false,

          message:
            "No valid workshops were found in the Excel file.",
        },
        {
          status:
            400,
        }
      );
    }

    const incomingIds = new Set(validWorkshops.map(w => createWorkshopId(w.title, w.programArea, w.offeringYear || "")));
    if (incomingIds.size !== validWorkshops.length) {
      return Response.json({ message: "Duplicate workshop titles and program areas in spreadsheet." }, { status: 400 });
    }
    const oldCatalog = await queryCosmosDocuments("workshops", "SELECT c.id, c.title, c.status FROM c WHERE c.status != 'deleted'");
    const discontinue = mode === "replace"
      ? oldCatalog.filter(w => !incomingIds.has(w.id))
      : [];
    if (preview) {
      return Response.json({ success: true, preview: true, mode,
        incoming: validWorkshops.length, existing: oldCatalog.length,
        discontinue: discontinue.map(w => ({ id: w.id, title: w.title })),
        note: "Replacement requires an explicit second confirmation. Historical achievements are retained." });
    }
    if (mode === "replace") {
      const confirmation = request.headers.get("x-catalogue-replace-confirm");
      if (confirmation !== "REPLACE CATALOGUE") {
        return Response.json({ success: false, message: "Explicit catalogue replacement confirmation is required." }, { status: 400 });
      }
    }

    if (mode === "replace") {
      // Preflight every discontinued workshop before changing the catalogue.
      // A pending or incomplete XP award must stop the entire replacement.
      for (const old of discontinue) {
        const completions = await queryCosmosDocuments(
          "registrations",
          "SELECT * FROM c WHERE c.workshopId = @id AND c.status = 'completed'",
          [{ name: "@id", value: old.id }]
        );
        for (const completion of completions) {
          const transaction = await readCosmosDocument(
            "xpTransactions", `${completion.studentId}_${old.id}`
          );
          if (transaction?.status !== "completed" || completion.completionXpAwarded !== true) {
            return Response.json({ success: false, code: "PENDING_REWARDS",
              message: `Cannot replace catalogue: ${old.title} has student XP pending reconciliation.`
            }, { status: 409 });
          }
        }
      }
    }
    /*
      Keep the same grouping size
      that the Firestore version
      previously used.

      Cosmos writes are performed
      individually because the
      workshops use /id as their
      partition key, meaning each
      workshop belongs to a
      different logical partition.
    */

    const batchSize =
      400;

    let importedCount =
      0;
    const existingImages = await queryCosmosDocuments("workshops", "SELECT c.id, c.image, c.imageAssetId FROM c");
    const byId = new Map(existingImages.map(w => [w.id,w]));
    const usedImages = workshopImageUsage(existingImages);

    for (
      let startIndex = 0;
      startIndex <
      validWorkshops.length;
      startIndex += batchSize
    ) {
      const currentWorkshops =
        validWorkshops.slice(
          startIndex,
          startIndex +
            batchSize
        );

      for (
        const workshop of
        currentWorkshops
      ) {
        const workshopData =
          buildImportedWorkshop(
            workshop,
            admin.uid
          );

        const existing = byId.get(workshopData.id);
        const validExistingImage = existing?.image && existing.image !== "/images/workshops/50_aviation-bundle.jpg";
        const assignment = validExistingImage
          ? {image: existing.image, imageAssetId: existing.imageAssetId || null, imageStatus: existing.imageAssetId ? "assigned" : "custom"}
          : assignWorkshopImage(workshopData, usedImages);
        if (assignment.imageAssetId && !validExistingImage) {
          usedImages.set(assignment.imageAssetId, (usedImages.get(assignment.imageAssetId) || 0) + 1);
        }
        await saveImportedWorkshop({ ...workshopData, ...assignment });

        importedCount += 1;
      }
    }

    let removedCount = 0;
    if (mode === "replace") {
      // Import first; on any failure the existing catalogue is still intact.
      // For each discontinuation, use the same history-safe deletion path.
      const { retireWorkshopPermanently } = await import("@/services/workshopRetirement");
      for (const prior of discontinue) {
        const current = await readCosmosDocument("workshops", prior.id);
        if (!current) continue;
        await retireWorkshopPermanently(current);
        removedCount++;
      }
    }

    return Response.json({
      success:
        true,

      message:
        mode === "replace" ? `Catalogue updated: ${importedCount} imported, ${removedCount} discontinued.` : `${importedCount} workshops imported successfully.`,
      removedCount,

      importedCount,
    });
  } catch (
    error
  ) {
    const accessResponse =
      adminAccessResponse(
        error
      );

    if (
      accessResponse
    ) {
      return accessResponse;
    }

    console.error(
      "Excel import error:",
      error
    );

    return Response.json(
      {
        success:
          false,

        message:
          "The Excel file could not be imported.",
      },
      {
        status:
          500,
      }
    );
  }
}