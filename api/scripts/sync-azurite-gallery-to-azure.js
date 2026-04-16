const {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} = require('@azure/storage-blob');
const { TableClient } = require('@azure/data-tables');

const SOURCE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
const TARGET_CONNECTION_STRING = process.env.TARGET_CONNECTION_STRING;
const GALLERY_TABLE_NAME = 'gallery';
const GALLERY_CONTAINER_NAME = 'gallery-images';

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

  clean.partitionKey = entity.partitionKey || entity.PartitionKey || 'gallery';
  clean.rowKey = entity.rowKey || entity.RowKey || '';
  delete clean.PartitionKey;
  delete clean.RowKey;

  return clean;
}

function extractBlobName(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(imageUrl);
    const marker = `/${GALLERY_CONTAINER_NAME}/`;
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

async function main() {
  if (!TARGET_CONNECTION_STRING) {
    throw new Error('TARGET_CONNECTION_STRING is required.');
  }

  const targetConnectionParts = parseConnectionString(TARGET_CONNECTION_STRING);
  const sharedKeyCredential = new StorageSharedKeyCredential(
    targetConnectionParts.AccountName,
    targetConnectionParts.AccountKey
  );

  const sourceBlobService = BlobServiceClient.fromConnectionString(SOURCE_CONNECTION_STRING);
  const targetBlobService = BlobServiceClient.fromConnectionString(TARGET_CONNECTION_STRING);
  const sourceContainer = sourceBlobService.getContainerClient(GALLERY_CONTAINER_NAME);
  const targetContainer = targetBlobService.getContainerClient(GALLERY_CONTAINER_NAME);
  await targetContainer.createIfNotExists();

  const sourceTable = TableClient.fromConnectionString(SOURCE_CONNECTION_STRING, GALLERY_TABLE_NAME);
  const targetTable = TableClient.fromConnectionString(TARGET_CONNECTION_STRING, GALLERY_TABLE_NAME);
  await targetTable.createTable();

  const copiedBlobNames = new Set();
  let copiedBlobCount = 0;
  let upsertedEntityCount = 0;

  for await (const sourceEntity of sourceTable.listEntities()) {
    const entity = sanitizeEntity(sourceEntity);
    const blobName = extractBlobName(entity.imageUrl);

    if (blobName) {
      const sourceBlob = sourceContainer.getBlobClient(blobName);
      const sourceBlobExists = await sourceBlob.exists();

      if (sourceBlobExists) {
        if (!copiedBlobNames.has(blobName)) {
          const download = await sourceBlob.download();
          const targetBlob = targetContainer.getBlockBlobClient(blobName);

          await targetBlob.uploadStream(download.readableStreamBody, undefined, undefined, {
            blobHTTPHeaders: {
              blobContentType: download.contentType || 'application/octet-stream'
            }
          });

          copiedBlobNames.add(blobName);
          copiedBlobCount += 1;
        }

        const readableUrl = buildReadableBlobUrl(
          targetContainer.getBlobClient(blobName),
          sharedKeyCredential
        );
        entity.imageUrl = readableUrl;
      }
    }

    await targetTable.upsertEntity(entity, 'Replace');
    upsertedEntityCount += 1;
  }

  console.log(
    JSON.stringify(
      {
        upsertedEntityCount,
        copiedBlobCount,
        table: GALLERY_TABLE_NAME,
        container: GALLERY_CONTAINER_NAME
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