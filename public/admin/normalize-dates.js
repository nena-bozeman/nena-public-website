/**
 * Normalize date-only CMS fields to YYYY-MM-DD strings before save so Decap list
 * sorting stays consistent. On disk these should be quoted YAML strings ('YYYY-MM-DD');
 * unquoted YAML dates parse as Date objects and sort in a separate group from strings.
 *
 * Date-only fields (keep in sync with config.yml x-*-field anchors and
 * scripts/validate-content-references.mjs):
 *   news:         date, meetingDate, submittedDate (date-only — quoted 'YYYY-MM-DD')
 *   events:       (not startDate/endDate — those include time)
 *   meetings:     meetingDate
 *   development:  submittedDate
 *   places/history/objectives: (no date-only publish fields)
 *
 * dateCreated and dateUpdated are optional audit fields and may include time — not normalized here.
 */
(function () {
  const DATE_ONLY_FIELDS = new Set([
    'date',
    'meetingDate',
    'submittedDate',
  ]);
  const DATETIME_FIELDS = new Set(['startDate', 'endDate']);

  function toDateOnly(value) {
    if (value == null || value === '') return value;
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value;
  }

  /** Keep datetime values as strings so Decap list sort does not split Date vs string. */
  function toDateTimeString(value) {
    if (value == null || value === '') return value;
    if (value instanceof Date) return value.toISOString();
    const text = String(value);
    const match = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
    return match ? match[1] : text;
  }

  CMS.registerWidgetValueSerializer('datetime', {
    serialize(value) {
      if (value == null || value === '') return '';
      return toDateTimeString(value);
    },
    deserialize(value) {
      if (value == null || value === '') return '';
      return toDateTimeString(value);
    },
  });

  CMS.registerEventListener({
    name: 'preSave',
    handler: ({ entry }) => {
      let data = entry.get('data');
      DATE_ONLY_FIELDS.forEach((field) => {
        if (data.has(field)) {
          data = data.set(field, toDateOnly(data.get(field)));
        }
      });
      DATETIME_FIELDS.forEach((field) => {
        if (data.has(field)) {
          data = data.set(field, toDateTimeString(data.get(field)));
        }
      });
      return data;
    },
  });
})();
