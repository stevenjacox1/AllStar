const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER_NAME = 'gallery-images';
const MAX_BYTES = 5 * 1024 * 1024;

function getConnectionString() {
  const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Missing AZURE_TABLE_STORAGE_CONNECTION_STRING setting.');
  }
  return connectionString;
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

    const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString());
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    await containerClient.createIfNotExists({ access: 'blob' });

    const blobName = buildBlobName(sectionKey, parsed.extension);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(parsed.buffer, {
      blobHTTPHeaders: { blobContentType: parsed.mimeType }
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        imageUrl: blockBlobClient.url,
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
