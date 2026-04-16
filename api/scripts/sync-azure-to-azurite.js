const fs = require('node:fs');
const path = require('node:path');
const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');

const AZURITE_CONNECTION_STRING =
  'UseDevelopmentStorage=true';

const DEFAULT_TABLES = ['gallery', process.env.EVENTS_TABLE_NAME || 'events'];
const DEFAULT_CONTAINERS = ['gallery-images'];

function readLocalSettings() {
  const localSettingsPath = path.join(__dirname, '..', 'local.settings.json');

  if (!fs.existsSync(localSettingsPath)) {
    throw new Error(`Missing local settings file at ${localSettingsPath}`);
  }

  const raw = fs.readFileSync(localSettingsPath, 'utf8');
  const parsed = JSON.parse(raw);
  const sourceConnectionString = parsed?.Values?.AZURE_TABLE_STORAGE_CONNECTION_STRING;

  if (!sourceConnectionString || sourceConnectionString.includes('<your-azure-storage-connection-string>')) {
    throw new Error('AZURE_TABLE_STORAGE_CONNECTION_STRING is missing or placeholder in api/local.settings.json');
  }

  return sourceConnectionString;
}

function sanitizeEntity(entity) {
  const clean = {};

  for (const [key, value] of Object.entries(entity)) {
    // Skip read-only/system fields not accepted on upsert.
    if (key === 'etag' || key === 'timestamp') {
      continue;
    }
    clean[key] = value;
  }

  return clean;
}

async function copyTable(tableName, sourceConnectionString) {
  const sourceClient = TableClient.fromConnectionString(sourceConnectionString, tableName);
  const destinationClient = TableClient.fromConnectionString(AZURITE_CONNECTION_STRING, tableName);

  await destinationClient.createTable();

  let count = 0;
  for await (const entity of sourceClient.listEntities()) {
    await destinationClient.upsertEntity(sanitizeEntity(entity), 'Replace');
    count += 1;
  }

  return count;
}

async function copyContainer(containerName, sourceConnectionString) {
  const sourceService = BlobServiceClient.fromConnectionString(sourceConnectionString);
  const destinationService = BlobServiceClient.fromConnectionString(AZURITE_CONNECTION_STRING);

  const sourceContainer = sourceService.getContainerClient(containerName);
  const sourceExists = await sourceContainer.exists();
  if (!sourceExists) {
    return 0;
  }

  const destinationContainer = destinationService.getContainerClient(containerName);
  await destinationContainer.createIfNotExists({ access: 'blob' });

  let count = 0;
  for await (const blob of sourceContainer.listBlobsFlat()) {
    const sourceBlob = sourceContainer.getBlobClient(blob.name);
    const destinationBlob = destinationContainer.getBlockBlobClient(blob.name);
    const downloadResponse = await sourceBlob.download();
    const contentType = downloadResponse.contentType || 'application/octet-stream';
    const metadata = blob.metadata || undefined;

    await destinationBlob.uploadStream(downloadResponse.readableStreamBody, undefined, undefined, {
      blobHTTPHeaders: { blobContentType: contentType },
      metadata
    });

    count += 1;
  }

  return count;
}

async function main() {
  const sourceConnectionString = readLocalSettings();

  console.log('Starting Azure -> Azurite sync...');

  for (const tableName of DEFAULT_TABLES) {
    const count = await copyTable(tableName, sourceConnectionString);
    console.log(`Table ${tableName}: copied ${count} entity(ies).`);
  }

  for (const containerName of DEFAULT_CONTAINERS) {
    const count = await copyContainer(containerName, sourceConnectionString);
    console.log(`Container ${containerName}: copied ${count} blob(s).`);
  }

  console.log('Sync complete.');
}

main().catch(error => {
  console.error('Sync failed:', error?.message || error);
  process.exitCode = 1;
});
