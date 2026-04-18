const { TableClient, TableServiceClient } = require('@azure/data-tables');

const TABLE_NAME = 'siteContent';
const PARTITION_KEY = 'site';

const DEFAULTS = {
  heroText: 'The BEST Sports Bar South of Seattle! In the beautiful city of Des Moines!!!'
};

function getClient() {
  const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Missing AZURE_TABLE_STORAGE_CONNECTION_STRING setting.');
  }
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

async function ensureTable() {
  const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return;
  try {
    const svc = TableServiceClient.fromConnectionString(connectionString);
    await svc.createTable(TABLE_NAME);
  } catch (e) {
    // 409 = already exists, safe to ignore
    if (e.statusCode !== 409) throw e;
  }
}

async function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

module.exports = async function (context, req) {
  try {
    await ensureTable();
    const client = getClient();
    const method = (req.method || 'GET').toUpperCase();
    const key = (req.params && req.params.key) || 'heroText';

    if (method === 'GET') {
      let value = DEFAULTS[key] !== undefined ? DEFAULTS[key] : '';
      try {
        const entity = await client.getEntity(PARTITION_KEY, key);
        if (typeof entity.value === 'string') value = entity.value;
      } catch (e) {
        if (e.statusCode !== 404) throw e;
      }
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { key, value }
      };
      return;
    }

    if (method === 'POST') {
      const body = await readBody(req);
      if (typeof body.value !== 'string' || body.value.trim().length === 0) {
        context.res = { status: 400, body: { error: 'value is required.' } };
        return;
      }
      const entity = {
        partitionKey: PARTITION_KEY,
        rowKey: key,
        value: body.value.trim()
      };
      await client.upsertEntity(entity, 'Replace');
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { key, value: entity.value }
      };
      return;
    }

    context.res = { status: 405, body: { error: 'Method not allowed.' } };
  } catch (err) {
    context.log.error('site-content error:', err);
    context.res = { status: 500, body: { error: 'Internal server error.' } };
  }
};
