import React from 'react';
import { sanitizeHtml } from './sanitizeHtml';

const inlineTags = new Set([
  'a',
  'b',
  'code',
  'em',
  'i',
  'span',
  'strong',
  'u',
]);
const blockTags = new Set(['div', 'li', 'ol', 'p', 'pre', 'ul']);

export const renderSanitizedHtml = (html?: string): React.ReactNode => {
  if (!html) return null;
  if (typeof document === 'undefined') return html;

  const template = document.createElement('template');
  template.innerHTML = sanitizeHtml(html);

  const renderNode = (node: ChildNode, key: React.Key): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes).map((child, index) =>
      renderNode(child, index),
    );

    if (tagName === 'br') {
      return React.createElement('br', { key });
    }

    if (tagName === 'a') {
      const href = element.getAttribute('href') || undefined;
      return React.createElement(
        'a',
        {
          href,
          key,
          rel: href ? 'noopener noreferrer' : undefined,
          target: href ? '_blank' : undefined,
          title: element.getAttribute('title') || undefined,
        },
        children,
      );
    }

    if (inlineTags.has(tagName) || blockTags.has(tagName)) {
      return React.createElement(tagName, { key }, children);
    }

    return React.createElement('span', { key }, children);
  };

  return React.createElement(
    React.Fragment,
    null,
    Array.from(template.content.childNodes).map((node, index) =>
      renderNode(node, index),
    ),
  );
};
