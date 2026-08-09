import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/services/firebase";

const workshopsCollection = collection(
  db,
  "workshops"
);

export async function getActiveWorkshops() {
  const workshopsQuery = query(
    workshopsCollection,
    where("status", "==", "active")
  );

  const workshopsSnapshot =
    await getDocs(workshopsQuery);

  const workshops = workshopsSnapshot.docs.map(
    (workshopDocument) => ({
      id: workshopDocument.id,
      ...workshopDocument.data(),
    })
  );

  return workshops.sort((firstWorkshop, secondWorkshop) =>
    firstWorkshop.title.localeCompare(
      secondWorkshop.title
    )
  );
}

export async function getWorkshopById(workshopId) {
  const workshopReference = doc(
    db,
    "workshops",
    workshopId
  );

  const workshopSnapshot =
    await getDoc(workshopReference);

  if (!workshopSnapshot.exists()) {
    return null;
  }

  return {
    id: workshopSnapshot.id,
    ...workshopSnapshot.data(),
  };
}

export async function createWorkshop(workshopData) {
  const workshopReference = await addDoc(
    workshopsCollection,
    {
      ...workshopData,
      status: workshopData.status || "active",
      xpReward: Number(workshopData.xpReward) || 100,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return workshopReference.id;
}

export async function updateWorkshop(
  workshopId,
  workshopData
) {
  const workshopReference = doc(
    db,
    "workshops",
    workshopId
  );

  await updateDoc(workshopReference, {
    ...workshopData,
    xpReward: Number(workshopData.xpReward) || 100,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWorkshop(workshopId) {
  const workshopReference = doc(
    db,
    "workshops",
    workshopId
  );

  await deleteDoc(workshopReference);
}