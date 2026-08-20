import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import OfficePreview from './OfficePreview';
import {
  renderDocxPreview,
  renderPptxPreview,
} from './officePreviewRenderers';

jest.mock('./officePreviewRenderers', () => ({
  renderDocxPreview: jest.fn(),
  renderPptxPreview: jest.fn(),
}));

describe('OfficePreview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders DOCX through the browser renderer', async () => {
    (renderDocxPreview as jest.Mock).mockResolvedValue(undefined);
    const blob = new Blob(['docx']);

    render(React.createElement(OfficePreview, { blob, extension: 'docx' }));

    const container = screen.getByLabelText('DOCX 文件预览');
    await waitFor(() =>
      expect(renderDocxPreview).toHaveBeenCalledWith(blob, container),
    );
  });

  it('renders PPTX and destroys the viewer on close', async () => {
    const destroy = jest.fn();
    (renderPptxPreview as jest.Mock).mockResolvedValue(destroy);
    const blob = new Blob(['pptx']);

    const { unmount } = render(
      React.createElement(OfficePreview, { blob, extension: 'pptx' }),
    );

    const container = screen.getByLabelText('PPTX 文件预览');
    await waitFor(() =>
      expect(renderPptxPreview).toHaveBeenCalledWith(
        blob,
        container,
        expect.any(AbortSignal),
      ),
    );

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
