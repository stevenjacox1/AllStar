const path = require('node:path');
const {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} = require('@azure/storage-blob');
const { TableClient } = require('@azure/data-tables');

const TARGET_CONNECTION_STRING = process.env.TARGET_CONNECTION_STRING;

const DAY_FILES = [
  ['monday', 'monday.jpg'],
  ['tuesday', 'tuesday.png'],
  ['wednesday', 'wednesday.jpg'],
  ['thursday', 'thursday.jpg'],
  ['friday', 'friday.jpg'],
  ['saturday', 'saturday.png'],
  ['sunday', 'sunday.jpg']
];

const DEFAULT_CAPTIONS = {
  monday: 'Miller Monday',
  tuesday: 'Taco Tuesday',
  wednesday: 'Hornitos Humpday',
  thursday: 'Crown Royal Thursday',
  friday: 'Fireball Friday',
  saturday: 'Svedka Saturday',
  sunday: 'Sunday All-Day Action'
};

const DEFAULT_HTML = '<p>Special details are unavailable right now.</p>';

function getContentType(fileName) {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  if (extension === 'png') {
    return 'image/png';
  }

  return 'image/jpeg';
}

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

async function getExistingEntity(tableClient, day) {
  try {
    return await tableClient.getEntity('gallery', day);
  } catch (error) {
    if (error.code === 'ResourceNotFound') {
      return null;
    }

    throw error;
  }
}

async function main() {
  if (!TARGET_CONNECTION_STRING) {
    throw new Error('TARGET_CONNECTION_STRING is required.');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(TARGET_CONNECTION_STRING);
  const connectionParts = parseConnectionString(TARGET_CONNECTION_STRING);
  const sharedKeyCredential = new StorageSharedKeyCredential(
    connectionParts.AccountName,
    connectionParts.AccountKey
  );
  const containerClient = blobServiceClient.getContainerClient('gallery-images');
  await containerClient.createIfNotExists();

  const tableClient = TableClient.fromConnectionString(TARGET_CONNECTION_STRING, 'gallery');
  await tableClient.createTable();

  const publicGalleryDir = path.resolve(__dirname, '..', '..', 'public', 'gallery');
  const results = [];

  for (const [day, fileName] of DAY_FILES) {
    const filePath = path.join(publicGalleryDir, fileName);
    const extension = path.extname(fileName).slice(1).toLowerCase();
    const blobName = `${day}-${Date.now()}.${extension}`;
    const blobClient = containerClient.getBlockBlobClient(blobName);

    await blobClient.uploadFile(filePath, {
      blobHTTPHeaders: { blobContentType: getContentType(fileName) }
    });

    const existing = await getExistingEntity(tableClient, day);
    const entity = {
      partitionKey: 'gallery',
      rowKey: day,
      day,
      isDaySection: true,
      sortOrder: DAY_FILES.findIndex(([key]) => key === day),
      html: existing?.html || existing?.markdown || DEFAULT_HTML,
      caption: existing?.caption || DEFAULT_CAPTIONS[day],
      imageUrl: buildReadableBlobUrl(blobClient, sharedKeyCredential)
    };

    await tableClient.upsertEntity(entity, 'Replace');

    results.push({
      day,
      fileName,
      imageUrl: blobClient.url
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});