import messages from '@intlify/unplugin-vue-i18n/messages';

/**
 * Resolve @:key.subkey linked-message references in a template string using a
 * locale's message catalog.  Handles nested references recursively; a depth
 * guard prevents infinite loops on circular entries (e.g. en.json has several).
 *
 * @param {string} template       - string that may contain @:namespace.key refs
 * @param {object} localeMessages - nested messages object for a single locale
 * @param {number} [depth=0]      - recursion depth (internal use)
 * @returns {string}
 */
function resolveTemplate(template, localeMessages, depth = 0) {
  if (depth > 10 || typeof template !== 'string') return template;
  return template.replace(/@:[a-z0-9._-]+/gi, ref => {
    const parts = ref.slice(2).split('.');
    let node = localeMessages;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) {
        node = node[part];
      } else {
        return ref; // key not found in this locale — keep as-is
      }
    }
    if (typeof node !== 'string') return ref;
    return resolveTemplate(node, localeMessages, depth + 1);
  });
}

function normalise(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Find a candidate whose i18n-templated name best matches a user-supplied string.
 *
 * Users may supply either the raw internal key (e.g. the @:-prefixed template
 * string stored by the UI) or a translated display string in any supported
 * locale.  Matching is case- and whitespace-insensitive to handle copy-paste
 * variation.
 *
 * Search order (first hit wins):
 *   1. Exact match against the raw template — fast path for the normal case
 *      where callers store canonical keys such as
 *      "@:paper-size.letter (@:paper-size.portrait)".
 *   2. Case/whitespace-normalised match against the raw template.
 *   3. Resolved match in the active locale.
 *   4. Resolved match in English ('en', then 'en-US').
 *   5. Resolved match across all remaining locales.
 *
 * @param {Array}    candidates    - items to search
 * @param {Function} getTemplate   - returns the raw i18n template for a candidate
 * @param {string}   value         - user-supplied string (raw key or translated text)
 * @param {string}   currentLocale - active i18n locale (e.g. 'de')
 * @returns {*} matching candidate, or null if not found
 */
export function findByI18nName(candidates, getTemplate, value, currentLocale) {
  if (!value || !candidates || candidates.length === 0) return null;

  // 1. Exact raw match.
  const exact = candidates.find(c => getTemplate(c) === value);
  if (exact) return exact;

  const normalised = normalise(value);

  // 2. Relaxed raw match — handles minor key variation without locale resolution.
  const relaxedRaw = candidates.find(c => normalise(getTemplate(c)) === normalised);
  if (relaxedRaw) return relaxedRaw;

  // Build a deduplicated locale search order: current → en → en-US → all others.
  const seen = new Set();
  const searchOrder = [currentLocale, 'en', 'en-US', ...Object.keys(messages)].filter(l => {
    if (!l || seen.has(l)) return false;
    seen.add(l);
    return true;
  });

  // 3–5. Resolve @: references for each locale and compare.
  for (const locale of searchOrder) {
    const localeMessages = messages[locale];
    if (!localeMessages) continue;
    const found = candidates.find(c =>
      normalise(resolveTemplate(getTemplate(c), localeMessages)) === normalised
    );
    if (found) return found;
  }

  return null;
}
