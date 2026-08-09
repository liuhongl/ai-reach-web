import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React, { useState } from 'react';
import BatchTargetUpload from './BatchTargetUpload';

const UploadHarness = ({ onError }: { onError: (message: string) => void }) => {
  const [file, setFile] = useState<File>(
    new File(['xlsx'], 'selected-targets.xlsx'),
  );
  return (
    <BatchTargetUpload
      downloading={false}
      file={file}
      onDownload={jest.fn()}
      onFileChange={(nextFile) => {
        if (nextFile) setFile(nextFile);
      }}
      onFileError={onError}
    />
  );
};

describe('BatchTargetUpload', () => {
  afterEach(cleanup);

  it('keeps the selected xlsx when a non-xlsx replacement is rejected', async () => {
    const onError = jest.fn();
    const { container } = render(<UploadHarness onError={onError} />);
    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('未找到名单文件选择框');
    }

    expect(input.accept).toBe('.xlsx');
    fireEvent.change(input, {
      target: { files: [new File(['csv'], 'replacement.csv')] },
    });

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('仅支持 .xlsx 格式的名单文件'),
    );
    expect(screen.getByText('selected-targets.xlsx')).toBeTruthy();
    expect(screen.queryByText('replacement.csv')).toBeNull();
  });
});
