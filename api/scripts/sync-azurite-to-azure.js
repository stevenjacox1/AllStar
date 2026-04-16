const {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} = require('@azure/storage-blob');
const { TableClient } = require('@azure/data-tables');

const SOURCE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
const TARGET_CONNECTION_STRING = process.env.TARGET_CONNECTION_STRING;
const TARGET_EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME || 'events';

const TABLES = ['gallery', TARGET_EVENTS_TABLE_NAME];
const CONTAINERS = ['gallery-images'];

function parseConnectionString(connectionString) {
  return Object.fromEntries(
    connectionString
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const separatorIndex = part.indexOf('=');
        return [part.slice(0, separatorIndex), part.slice(separatorIndex + 1)];
      })
  );
}

function sanitizeEntity(entity) {
  const clean = {};

  for (const [key, value] of Object.entries(entity)) {
    if (key === 'etag' || key === 'timestamp') {
      continue;
    }

    clean[key] = value;
  }

  clean.partitionKey = entity.partitionKey || entity.PartitionKey || clean.partitionKey;
  clean.rowKey = entity.rowKey || entity.RowKey || clean.rowKey;
  delete clean.PartitionKey;
  delete clean.RowKey;

  return clean;
}

function extractBlobNameFromUrl(imageUrl, containerName) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(imageUrl);
    const marker = `/${containerName}/`;
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function buildReadableBlobUrl(blobClient, sharedKeyCredential) {
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: blobClient.containerName,
      blobName: blobClient.name,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn
    },
    sharedKeyCredential
  ).toString();

  return `${blobClient.url}?${sasToken}`;
}

async function copyContainer(sourceBlobService, targetBlobService, containerName) {
  const sourceContainer = sourceBlobService.getContainerClient(containerName);
  const targetContainer = targetBlobService.getContainerClient(containerName);

  const sourceExists = await sourceContainer.exists();
  if (!sourceExists) {
    return { copiedBlobCount: 0, targetContainer };
  }

  await targetContainer.createIfNotExists();

  let copiedBlobCount = 0;
  for await (const blob of sourceContainer.listBlobsFlat()) {
    const sourceBlob = sourceContainer.getBlobClient(blob.name);
    const targetBlob = targetContainer.getBlockBlobClient(blob.name);
    const download = await sourceBlob.download();

    await targetBlob.uploadStream(download.readableStreamBody, undefined, undefined, {
      blobHTTPHeaders: {
        blobContentType: download.contentType || 'application/octet-stream'
      },
      metadata: blob.metadata || undefined
    });

    copiedBlobCount += 1;
  }

  return { copiedBlobCount, targetContainer };
}

async function copyTable(sourceConnectionString, targetConnectionString, tableName, options = {}) {
  const sourceTable = TableClient.fromConnectionString(sourceConnectionString, tableName);
  const targetTable = TableClient.fromConnectionString(targetConnectionString, tableName);
  await targetTable.createTable();

  let upsertedEntityCount = 0;
  for await (const sourceEntity of sourceTable.listEntities()) {
    const entity = sanitizeEntity(sourceEntity);

    if (options.rewriteImageUrls && entity.imageUrl) {
      const blobName = extractBlobNameFromUrl(entity.imageUrl, options.containerName);
      if (blobName) {
        const blobClient = options.targetContainer.getBlobClient(blobName);
        entity.imageUrl = buildReadableBlobUrl(blobClient, options.sharedKeyCredential);
      }
    }

    await targetTable.upsertEntity(entity, 'Replace');
    upsertedEntityCount += 1;
  }

  return upsertedEntityCount;
}

async function main() {
  if (!TARGET_CONNECTION_STRING) {
    throw new Error('TARGET_CONNECTION_STRING is required.');
  }

  const targetParts = parseConnectionString(TARGET_CONNECTION_STRING);
  const sharedKeyCredential = new StorageSharedKeyCredential(
    targetParts.AccountName,
    targetParts.AccountKey
  );

  const sourceBlobService = BlobServiceClient.fromConnectionString(SOURCE_CONNECTION_STRING);
  const targetBlobService = BlobServiceClient.fromConnectionString(TARGET_CONNECTION_STRING);

  const containerResults = [];
  const containerMap = new Map();
  for (const containerName of CONTAINERS) {
    const result = await copyContainer(sourceBlobService, targetBlobService, containerName);
    containerMap.set(containerName, result.targetContainer);
    containerResults.push({
      containerName,
      copiedBlobCount: result.copiedBlobCount
    });
  }

  const tableResults = [];
  for (const tableName of TABLES) {
    const isGallery = tableName === 'gallery';
    const upsertedEntityCount = await copyTable(
      SOURCE_CONNECTION_STRING,
      TARGET_CONNECTION_STRING,
      tableName,
      isGallery
        ? {
            rewriteImageUrls: true,
            containerName: 'gallery-images',
            targetContainer: containerMap.get('gallery-images'),
            sharedKeyCredential
          }
        : {}
    );

    tableResults.push({ tableName, upsertedEntityCount });
  }

  console.log(
    JSON.stringify(
      {
        source: 'azurite',
        target: 'azure',
        tableResults,
        containerResults
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error('Sync failed:', error?.message || error);
  process.exitCode = 1;
});