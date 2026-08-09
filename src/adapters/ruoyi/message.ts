import type React from 'react';
import { renderSanitizedHtml } from '@/utils/renderSanitizedHtml';

type MessageContent = string | React.ReactNode;

type MessageApi = {
  error: (content: MessageContent) => unknown;
  info: (content: MessageContent) => unknown;
};

let ruoyiMessage: MessageApi | undefined;

export const setRuoyiMessage = (messageApi: MessageApi) => {
  ruoyiMessage = messageApi;
};

export const showRuoyiError = (content: string) => {
  if (!ruoyiMessage) {
    console.error(content);
    return;
  }

  ruoyiMessage.error(content);
};

export const showRuoyiInfo = (content: string) => {
  if (!ruoyiMessage) {
    console.info(content);
    return;
  }

  ruoyiMessage.info(content);
};

export const showRuoyiHtmlInfo = (html: string) => {
  const content = renderSanitizedHtml(html);

  if (!ruoyiMessage) {
    console.info(html);
    return;
  }

  ruoyiMessage.info(content);
};
