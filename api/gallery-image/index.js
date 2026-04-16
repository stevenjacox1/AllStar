const {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} = require('@azure/storage-blob');

const CONTAINER_NAME = 'gallery-images';
const MAX_BYTES = 5 * 1024 * 1024;

function getConnectionString() {
  const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Missing AZURE_TABLE_STORAGE_CONNECTION_STRING setting.');
  }
  return connectionString;
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

function getSharedKeyCredential(connectionString) {
  if (connectionString === 'UseDevelopmentStorage=true') {
    return null;
  }

  const parts = parseConnectionString(connectionString);
  return new StorageSharedKeyCredential(parts.AccountName, parts.AccountKey);
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

function readBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function normalizeSectionKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9:-]/g, '-');
}

function buildBlobName(sectionKey, extension) {
  const safeKey = normalizeSectionKey(sectionKey);
  const timestamp = Date.now();
  return `${safeKey}-${timestamp}.${extension}`;
}

function parseDataUri(dataUri) {
  const match = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUri || '');
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const extension = mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? 'jpg' : mimeType.split('/')[1];
  const buffer = Buffer.from(match[3], 'base64');

  return { mimeType, extension, buffer };
}

module.exports = async function (context, req) {
  try {
    const body = readBody(req);
    const sectionKey = normalizeSectionKey(body.sectionKey);
    const parsed = parseDataUri(body.imageDataUrl);
    const connectionString = getConnectionString();

    if (!sectionKey) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'sectionKey is required' }
      };
      return;
    }

    if (!parsed) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'imageDataUrl must be a base64 data URI for png/jpeg/webp/gif' }
      };
      return;
    }

    if (parsed.buffer.byteLength > MAX_BYTES) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Image exceeds 5MB limit' }
      };
      return;
    }

    const isDevelopmentStorage = connectionString === 'UseDevelopmentStorage=true';
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const sharedKeyCredential = getSharedKeyCredential(connectionString);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    if (isDevelopmentStorage) {
      await containerClient.createIfNotExists({ access: 'blob' });
    } else {
      await containerClient.createIfNotExists();
    }

    const blobName = buildBlobName(sectionKey, parsed.extension);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(parsed.buffer, {
      blobHTTPHeaders: { blobContentType: parsed.mimeType }
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        imageUrl: isDevelopmentStorage
          ? blockBlobClient.url
          : buildReadableBlobUrl(blockBlobClient, sharedKeyCredential),
        blobName
      }
    };
  } catch (error) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Failed to upload gallery image', details: error.message }
    };
  }
};
