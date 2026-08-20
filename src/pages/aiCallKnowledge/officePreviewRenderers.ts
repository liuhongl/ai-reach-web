export const renderDocxPreview = async (blob: Blob, container: HTMLElement) => {
  const { renderAsync } = await import('docx-preview');
  await renderAsync(blob, container, undefined, {
    renderAltChunks: false,
    useBase64URL: true,
  });
};

export const renderPptxPreview = async (
  blob: Blob,
  container: HTMLElement,
  signal: AbortSignal,
) => {
  const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import(
    '@aiden0z/pptx-renderer'
  );
  const viewer = await PptxViewer.open(blob, container, {
    zipLimits: RECOMMENDED_ZIP_LIMITS,
    lazyMedia: true,
    lazySlides: true,
    renderMode: 'list',
    listOptions: { windowed: true },
    scrollContainer: container,
    signal,
  });
  return () => viewer.destroy();
};
