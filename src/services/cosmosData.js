import {
  getCosmosContainer,
} from "@/services/cosmos";

function getStatusCode(
  error
) {
  return (
    error?.code ||
    error?.statusCode ||
    error?.status ||
    null
  );
}

function stripCosmosMetadata(
  document
) {
  if (
    !document ||
    typeof document !==
      "object"
  ) {
    return document;
  }

  const {
    _rid,
    _self,
    _etag,
    _attachments,
    _ts,
    ...cleanDocument
  } =
    document;

  return cleanDocument;
}

export function cosmosNow() {
  return new Date().toISOString();
}

export function isCosmosConflict(
  error
) {
  return (
    getStatusCode(
      error
    ) ===
    409
  );
}

export function isCosmosPreconditionFailed(
  error
) {
  return (
    getStatusCode(
      error
    ) ===
    412
  );
}

export async function readCosmosDocument(
  containerName,
  id
) {
  if (
    !containerName ||
    !id
  ) {
    throw new Error(
      "Container name and document ID are required."
    );
  }

  try {
    const {
      resource,
    } =
      await getCosmosContainer(
        containerName
      )
        .item(
          id,
          id
        )
        .read();

    return (
      resource ||
      null
    );
  } catch (
    error
  ) {
    if (
      getStatusCode(
        error
      ) ===
      404
    ) {
      return null;
    }

    throw error;
  }
}

export async function createCosmosDocument(
  containerName,
  document
) {
  if (
    !containerName ||
    !document?.id
  ) {
    throw new Error(
      "Container name and document ID are required."
    );
  }

  const {
    resource,
  } =
    await getCosmosContainer(
      containerName
    )
      .items
      .create(
        document
      );

  return resource;
}

export async function queryCosmosDocuments(
  containerName,
  query,
  parameters = []
) {
  if (
    !containerName ||
    !query
  ) {
    throw new Error(
      "Container name and query are required."
    );
  }

  const {
    resources,
  } =
    await getCosmosContainer(
      containerName
    )
      .items
      .query(
        {
          query,
          parameters,
        }
      )
      .fetchAll();

  return (
    resources ||
    []
  );
}

export async function replaceCosmosDocument(
  containerName,
  currentDocument,
  updates = {}
) {
  if (
    !containerName ||
    !currentDocument?.id
  ) {
    throw new Error(
      "Container name and existing document are required."
    );
  }

  const replacement =
    stripCosmosMetadata(
      {
        ...currentDocument,
        ...updates,

        id:
          currentDocument.id,
      }
    );

  const options =
    currentDocument._etag
      ? {
          accessCondition:
            {
              type:
                "IfMatch",

              condition:
                currentDocument._etag,
            },
        }
      : undefined;

  const {
    resource,
  } =
    await getCosmosContainer(
      containerName
    )
      .item(
        currentDocument.id,
        currentDocument.id
      )
      .replace(
        replacement,
        options
      );

  return resource;
}

export async function deleteCosmosDocument(
  containerName,
  id
) {
  if (
    !containerName ||
    !id
  ) {
    throw new Error(
      "Container name and document ID are required."
    );
  }

  try {
    await getCosmosContainer(
      containerName
    )
      .item(
        id,
        id
      )
      .delete();

    return true;
  } catch (
    error
  ) {
    if (
      getStatusCode(
        error
      ) ===
      404
    ) {
      return false;
    }

    throw error;
  }
}