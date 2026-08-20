import { Alert, Spin } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  renderDocxPreview,
  renderPptxPreview,
} from './officePreviewRenderers';

type OfficePreviewProps = {
  blob: Blob;
  extension: 'docx' | 'pptx';
};

const OfficePreview = ({ blob, extension }: OfficePreviewProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const controller = new AbortController();
    let disposed = false;
    let destroyViewer: (() => void) | undefined;
    setState('loading');

    const renderOffice = async () => {
      const cleanup =
        extension === 'docx'
          ? await renderDocxPreview(blob, container)
          : await renderPptxPreview(blob, container, controller.signal);
      if (typeof cleanup === 'function') {
        if (disposed) cleanup();
        else destroyViewer = cleanup;
      }
      if (!disposed) setState('ready');
    };

    void renderOffice().catch(() => {
      if (!disposed) setState('error');
    });

    return () => {
      disposed = true;
      controller.abort();
      destroyViewer?.();
      container.replaceChildren();
    };
  }, [blob, extension]);

  return (
    <div>
      <Alert
        showIcon
        type="info"
        title="Office 在线预览仅供内容核对，复杂版式请以下载的原文件为准。"
        style={{ marginBottom: 12 }}
      />
      {state === 'error' ? (
        <Alert showIcon type="error" title="在线预览失败，请下载原文件查看。" />
      ) : null}
      <Spin spinning={state === 'loading'}>
        <section
          ref={containerRef}
          aria-label={`${extension.toUpperCase()} 文件预览`}
          style={{
            height: '70vh',
            overflow: 'auto',
            background: '#f5f5f5',
          }}
        />
      </Spin>
    </div>
  );
};

export default OfficePreview;
