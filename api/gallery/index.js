const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'gallery';
const PARTITION_KEY = 'gallery';
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DEFAULT_CAPTIONS = {
  monday: 'Miller Monday',
  tuesday: 'Taco Tuesday',
  wednesday: 'Hornitos Humpday',
  thursday: 'Crown Royal Thursday',
  friday: 'Fireball Friday',
  saturday: 'Svedka Saturday',
  sunday: 'Sunday All-Day Action'
};

function getClient() {
  const connectionString = process.env.AZURE_TABLE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Missing AZURE_TABLE_STORAGE_CONNECTION_STRING setting.');
  }
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
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

function isValidDay(day) {
  return DAYS.includes(day.toLowerCase());
}

function normalizeHtml(html) {
  return html.replace(/font-color\s*:/gi, 'color:');
}

function getDefaultCaption(dayKey) {
  return DEFAULT_CAPTIONS[dayKey] || '';
}

module.exports = async function (context, req) {
  try {
    const client = getClient();
    await client.createTable();

    const method = req.method.toUpperCase();
    const day = req.params?.day;
    const payload = await readBody(req);

    // GET /api/gallery - list all
    if (method === 'GET' && !day) {
      const items = [];
      for await (const entity of client.listEntities({
        queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` }
      })) {
        items.push({
          day: entity.rowKey,
          html: normalizeHtml(entity.html || entity.markdown || ''),
          caption: entity.caption || getDefaultCaption(entity.rowKey)
        });
      }
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: items
      };
      return;
    }

    // GET /api/gallery/{day}
    if (method === 'GET' && day) {
      if (!isValidDay(day)) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: `Invalid day. Must be one of: ${DAYS.join(', ')}` }
        };
        return;
      }
      try {
        const entity = await client.getEntity(PARTITION_KEY, day.toLowerCase());
        context.res = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            day: entity.rowKey,
            html: normalizeHtml(entity.html || entity.markdown || ''),
            caption: entity.caption || getDefaultCaption(entity.rowKey)
          }
        };
        return;
      } catch (error) {
        if (error.code === 'ResourceNotFound') {
          context.res = {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
            body: { error: `Gallery item for ${day} not found` }
          };
        } else {
          context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Failed to retrieve gallery item' }
          };
        }
        return;
      }
    }

    // PUT /api/gallery/{day}
    if (method === 'PUT') {
      if (!day) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Day parameter is required for PUT request' }
        };
        return;
      }
      if (!isValidDay(day)) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: `Invalid day. Must be one of: ${DAYS.join(', ')}` }
        };
        return;
      }
      const html = typeof payload.html === 'string'
        ? payload.html
        : (typeof payload.markdown === 'string' ? payload.markdown : null);
      const caption = typeof payload.caption === 'string'
        ? payload.caption.trim()
        : getDefaultCaption(day.toLowerCase());

      if (html == null || !html.trim()) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'html field is required and must be a non-empty string' }
        };
        return;
      }
      try {
        const normalizedHtml = normalizeHtml(html);
        const entity = {
          partitionKey: PARTITION_KEY,
          rowKey: day.toLowerCase(),
          html: normalizedHtml,
          caption
        };
        await client.upsertEntity(entity);
        context.res = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            day: entity.rowKey,
            html: entity.html,
            caption: entity.caption
          }
        };
        return;
      } catch (error) {
        context.res = {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Failed to save gallery item' }
        };
        return;
      }
    }

    // DELETE /api/gallery/{day}
    if (method === 'DELETE') {
      if (!day) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Day parameter is required for DELETE request' }
        };
        return;
      }
      if (!isValidDay(day)) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: `Invalid day. Must be one of: ${DAYS.join(', ')}` }
        };
        return;
      }
      try {
        await client.deleteEntity(PARTITION_KEY, day.toLowerCase());
        context.res = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'Gallery item deleted successfully' }
        };
        return;
      } catch (error) {
        if (error.code === 'ResourceNotFound') {
          context.res = {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
            body: { error: `Gallery item for ${day} not found` }
          };
        } else {
          context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Failed to delete gallery item' }
          };
        }
        return;
      }
    }

    // Method not allowed
    context.res = {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Method not allowed' }
    };
  } catch (error) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Internal server error', details: error.message }
    };
  }
};
