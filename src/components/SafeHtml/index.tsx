import React from 'react';
import { renderSanitizedHtml } from '@/utils/renderSanitizedHtml';

type SafeHtmlProps = {
  className?: string;
  html?: string;
};

const SafeHtml: React.FC<SafeHtmlProps> = ({ className, html }) => (
  <div className={className}>{renderSanitizedHtml(html)}</div>
);

export default SafeHtml;
