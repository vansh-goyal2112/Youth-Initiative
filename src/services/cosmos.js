import {
  CosmosClient,
} from "@azure/cosmos";

import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
} from "@azure/identity";

let cosmosClient = null;

function getCosmosConfiguration() {
  const endpoint =
    process.env.COSMOS_ENDPOINT;

  const databaseName =
    process.env.COSMOS_DATABASE_NAME ||
    "YouthInitiative";

  if (!endpoint) {
    throw new Error(
      "COSMOS_ENDPOINT environment variable is missing."
    );
  }

  return {
    endpoint,
    databaseName,
  };
}

function createAzureCredential() {
  /*
    Azure deployment:
    use the user-assigned managed identity
    attached to our Container App.

    Local development:
    DefaultAzureCredential can use the
    developer's existing Azure CLI login.
  */

  const managedIdentityClientId =
    process.env
      .AZURE_MANAGED_IDENTITY_CLIENT_ID;

  if (
    process.env.NODE_ENV ===
      "production" &&
    managedIdentityClientId
  ) {
    return new ManagedIdentityCredential(
      managedIdentityClientId
    );
  }

  return new DefaultAzureCredential();
}

function getCosmosClient() {
  if (cosmosClient) {
    return cosmosClient;
  }

  const {
    endpoint,
  } =
    getCosmosConfiguration();

  cosmosClient =
    new CosmosClient({
      endpoint,
      aadCredentials:
        createAzureCredential(),
    });

  return cosmosClient;
}

function getCosmosDatabase() {
  const {
    databaseName,
  } =
    getCosmosConfiguration();

  return getCosmosClient().database(
    databaseName
  );
}

function getCosmosContainer(
  containerName
) {
  if (
    !containerName ||
    typeof containerName !==
      "string"
  ) {
    throw new Error(
      "A Cosmos DB container name is required."
    );
  }

  return getCosmosDatabase().container(
    containerName
  );
}

export {
  getCosmosClient,
  getCosmosContainer,
  getCosmosDatabase,
};