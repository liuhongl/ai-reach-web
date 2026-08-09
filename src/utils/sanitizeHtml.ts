const blockedTags = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
]);

const urlAttributes = new Set(['href', 'src', 'xlink:href']);

const isUnsafeUrl = (value: string) =>
  /^\s*(javascript|vbscript|data):/i.test(value);

export const sanitizeHtml = (html?: string) => {
  if (!html || typeof window === 'undefined') return html || '';

  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('*').forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    if (blockedTags.has(tagName)) {
      element.remove();
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (urlAttributes.has(name) && isUnsafeUrl(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return template.innerHTML;
};
