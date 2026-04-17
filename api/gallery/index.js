const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = 'gallery';
const PARTITION_KEY = 'gallery';
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const EXTRA_PREFIX = 'extra:';
const SLIDESHOW_PREFIX = 'slideshow:';
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

function toExtraSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toSectionRowKey(value) {
  const trimmed = String(value || '').toLowerCase().trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith(SLIDESHOW_PREFIX)) {
    const raw = trimmed.slice(SLIDESHOW_PREFIX.length);
    const slug = toExtraSlug(raw);
    return slug ? `${SLIDESHOW_PREFIX}${slug}` : '';
  }

  if (trimmed.startsWith(EXTRA_PREFIX)) {
    const raw = trimmed.slice(EXTRA_PREFIX.length);
    const slug = toExtraSlug(raw);
    return slug ? `${EXTRA_PREFIX}${slug}` : '';
  }

  const slug = toExtraSlug(trimmed);
  return slug ? `${EXTRA_PREFIX}${slug}` : '';
}

function normalizeHtml(html) {
  return html.replace(/font-color\s*:/gi, 'color:');
}

function getDefaultCaption(dayKey) {
  return DEFAULT_CAPTIONS[dayKey] || '';
}

function toGalleryItem(entity) {
  const key = String(entity.rowKey || '').toLowerCase();
  const day = isValidDay(key)
    ? key
    : (typeof entity.day === 'string' && isValidDay(entity.day) ? entity.day.toLowerCase() : null);
  const isDaySection = day !== null;
  const sortOrder = Number.isFinite(Number(entity.sortOrder))
    ? Number(entity.sortOrder)
    : (isDaySection ? DAYS.indexOf(day) : Number.MAX_SAFE_INTEGER);

  return {
    key,
    day,
    isDaySection,
    isSlideshow: key.startsWith(SLIDESHOW_PREFIX),
    sortOrder,
    html: normalizeHtml(entity.html || entity.markdown || ''),
    caption: entity.caption || (day ? getDefaultCaption(day) : 'Additional Special'),
    imageUrl: entity.imageUrl || ''
  };
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
        items.push(toGalleryItem(entity));
      }

      items.sort((a, b) => a.sortOrder - b.sortOrder || a.caption.localeCompare(b.caption));

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
          body: toGalleryItem(entity)
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

    // POST /api/gallery - create/update non-day section
    if (method === 'POST') {
      const html = typeof payload.html === 'string'
        ? payload.html
        : (typeof payload.markdown === 'string' ? payload.markdown : null);
      const caption = typeof payload.caption === 'string' ? payload.caption.trim() : '';
      const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : '';
      const rowKey = toSectionRowKey(payload.key || payload.sectionKey || caption);
      const sortOrder = Number.isFinite(Number(payload.sortOrder))
        ? Number(payload.sortOrder)
        : Date.now();

      if (!rowKey) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'A key or caption is required to create a section' }
        };
        return;
      }

      if (html == null || !html.trim()) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'html field is required and must be a non-empty string' }
        };
        return;
      }

      if (!caption) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'caption field is required and must be a non-empty string' }
        };
        return;
      }

      try {
        const normalizedHtml = normalizeHtml(html);
        const entity = {
          partitionKey: PARTITION_KEY,
          rowKey,
          html: normalizedHtml,
          caption,
          sortOrder,
          imageUrl
        };
        await client.upsertEntity(entity);
        context.res = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: toGalleryItem(entity)
        };
        return;
      } catch (error) {
        context.res = {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Failed to save gallery section' }
        };
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
      const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : '';

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
          day: day.toLowerCase(),
          isDaySection: true,
          sortOrder: DAYS.indexOf(day.toLowerCase()),
          html: normalizedHtml,
          caption,
          imageUrl
        };
        await client.upsertEntity(entity);
        context.res = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: toGalleryItem(entity)
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

    // DELETE /api/gallery/{dayOrKey}
    if (method === 'DELETE') {
      if (!day) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Day parameter is required for DELETE request' }
        };
        return;
      }

      const normalizedParam = String(day).toLowerCase();
      const rowKey = isValidDay(normalizedParam)
        ? normalizedParam
        : toSectionRowKey(normalizedParam);

      if (!rowKey) {
        context.res = {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Invalid section key for DELETE request' }
        };
        return;
      }

      try {
        await client.deleteEntity(PARTITION_KEY, rowKey);
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
            body: { error: `Gallery item for ${normalizedParam} not found` }
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
