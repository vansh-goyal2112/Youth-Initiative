import { workshopCompletionSnapshot } from "@/services/workshopHistory.mjs";
import { cosmosNow, queryCosmosDocuments, readCosmosDocument, replaceCosmosDocument, deleteCosmosDocument } from "@/services/cosmosData";

export async function retireWorkshopPermanently(existingWorkshop) {
  const id = existingWorkshop.id;
    // First persist independent historical records. If any write fails,
    // stop without deleting the catalogue record.
    const completed = await queryCosmosDocuments(
      "registrations",
      "SELECT * FROM c WHERE c.workshopId = @workshopId AND c.status = 'completed'",
      [{ name: "@workshopId", value: id }]
    );
    for (const registration of completed) {
      const transaction = await readCosmosDocument(
        "xpTransactions", `${registration.studentId}_${id}`
      );
      if (!transaction || transaction.status !== "completed" || registration.completionXpAwarded !== true) {
        throw new Error("Finalize pending student XP awards before workshop removal.");
      }
      const snapshot = registration.workshopSnapshot ||
        workshopCompletionSnapshot(existingWorkshop, registration, transaction);
      if (!registration.workshopSnapshot) {
        await replaceCosmosDocument("registrations", registration, {
          workshopSnapshot: snapshot, updatedAt: cosmosNow(),
        });
      }
    }
    // Uncompleted registrations / QR sessions must not be left usable.
    const pending = await queryCosmosDocuments(
      "registrations",
      "SELECT * FROM c WHERE c.workshopId = @workshopId AND c.status != 'completed'",
      [{ name: "@workshopId", value: id }]
    );
    for (const registration of pending) {
      if (registration.status !== "cancelled") {
        await replaceCosmosDocument("registrations", registration, {
          status: "cancelled", cancelledReason: "workshop_discontinued",
          updatedAt: cosmosNow(),
        });
      }
    }
    const sessions = await queryCosmosDocuments(
      "attendanceSessions",
      "SELECT * FROM c WHERE c.workshopId = @workshopId AND c.active = true",
      [{ name: "@workshopId", value: id }]
    );
    for (const session of sessions) {
      await replaceCosmosDocument("attendanceSessions", session, {
        active: false, updatedAt: cosmosNow(),
      });
    }
    // Disallow physical deletion if any completed record lacks its snapshot.
    const verify = await queryCosmosDocuments(
      "registrations",
      "SELECT c.id, c.workshopSnapshot FROM c WHERE c.workshopId = @workshopId AND c.status = 'completed'",
      [{ name: "@workshopId", value: id }]
    );
    if (verify.some(row => !row.workshopSnapshot?.id)) {
      throw new Error("Historical completion preservation did not finish.");
    }
    await deleteCosmosDocument("workshops", id);

  return true;
}
