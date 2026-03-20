const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = process.env.EVENTS_TABLE_NAME || 'events';
const PARTITION_KEY = 'events';

function getClient() {
  const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Missing AZURE_TABLE_STORAGE_CONNECTION_STRING setting.');
  }
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

function toEvent(entity) {
  return {
    id: entity.rowKey,
    title: entity.title || '',
    date: entity.date || '',
    time: entity.time || '',
    description: entity.description || ''
  };
}

async function readBody(req) {
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

function validateEventPayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Invalid event payload.';
  if (!payload.title || typeof payload.title !== 'string') return 'title is required.';
  if (!payload.date || typeof payload.date !== 'string') return 'date is required (YYYY-MM-DD).';
  if (payload.time != null && typeof payload.time !== 'string') return 'time must be a string.';
  if (payload.description != null && typeof payload.description !== 'string') return 'description must be a string.';
  return null;
}

module.exports = async function (context, req) {
  try {
    const client = getClient();
    await client.createTable();

    const method = req.method.toUpperCase();
    const id = req.params.id;

    if (method === 'GET') {
      const events = [];
      for await (const entity of client.listEntities({
        queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` }
      })) {
        events.push(toEvent(entity));
      }
      events.sort((a, b) => a.date.localeCompare(b.date));
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: events
      };
      return;
    }

    if (method === 'POST') {
      const payload = await readBody(req);
      const validationError = validateEventPayload(payload);
      if (validationError) {
        context.res = { status: 400, body: { error: validationError } };
        return;
      }

      const eventId = (globalThis.crypto && globalThis.crypto.randomUUID)
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      const entity = {
        partitionKey: PARTITION_KEY,
        rowKey: eventId,
        title: payload.title.trim(),
        date: payload.date,
        time: (payload.time || '').trim(),
        description: (payload.description || '').trim(),
        updatedAt: new Date().toISOString()
      };

      await client.createEntity(entity);

      context.res = {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: toEvent(entity)
      };
      return;
    }

    if (method === 'PUT') {
      if (!id) {
        context.res = { status: 400, body: { error: 'Event id is required.' } };
        return;
      }

      const payload = await readBody(req);
      const validationError = validateEventPayload(payload);
      if (validationError) {
        context.res = { status: 400, body: { error: validationError } };
        return;
      }

      const entity = {
        partitionKey: PARTITION_KEY,
        rowKey: id,
        title: payload.title.trim(),
        date: payload.date,
        time: (payload.time || '').trim(),
        description: (payload.description || '').trim(),
        updatedAt: new Date().toISOString()
      };

      await client.upsertEntity(entity, 'Replace');

      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: toEvent(entity)
      };
      return;
    }

    if (method === 'DELETE') {
      if (!id) {
        context.res = { status: 400, body: { error: 'Event id is required.' } };
        return;
      }

      await client.deleteEntity(PARTITION_KEY, id);
      context.res = { status: 204 };
      return;
    }

    context.res = { status: 405, body: { error: 'Method not allowed.' } };
  } catch (error) {
    context.log.error(error);
    context.res = {
      status: 500,
      body: { error: 'Server error', details: error?.message || 'Unknown error' }
    };
  }
};
