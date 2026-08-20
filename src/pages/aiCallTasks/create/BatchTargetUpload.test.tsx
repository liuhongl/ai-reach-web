import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React, { useState } from 'react';
import BatchTargetUpload from './BatchTargetUpload';

const UploadHarness = ({ onError }: { onError: (message: string) => void }) => {
  const [file, setFile] = useState<File | undefined>(
    new File(['xlsx'], 'selected-targets.xlsx'),
  );
  return (
    <BatchTargetUpload
      downloading={false}
      file={file}
      onDownload={jest.fn()}
      onFileChange={setFile}
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
    expect(
      screen.getByRole('button', {
        name: '完整文件名：selected-targets.xlsx',
      }),
    ).toBeTruthy();
    expect(screen.queryByText('replacement.csv')).toBeNull();
  });

  it('shows an obvious selected state and keeps the extension visible', async () => {
    const { container } = render(<UploadHarness onError={jest.fn()} />);
    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('未找到名单文件选择框');
    }
    const longFileName = '2026年8月灵宸科技华东区域第一批重点客户外呼名单.xlsx';
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File(['xlsx'], longFileName)] },
      });
    });

    expect(screen.getByText('已选择外呼名单')).toBeTruthy();
    expect(
      screen
        .getByText('已选择外呼名单')
        .closest('[aria-live="polite"]')
        ?.classList.contains('sm:h-28'),
    ).toBe(true);
    expect(
      screen.getByRole('button', {
        name: `完整文件名：${longFileName}`,
      }),
    ).toBeTruthy();
    expect(screen.getByText('.xlsx').classList.contains('shrink-0')).toBe(true);
    expect(document.querySelector('.ant-upload-list')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /移除/ }));
    expect(screen.queryByText('已选择外呼名单')).toBeNull();
    expect(screen.getByText('上传完整外呼名单')).toBeTruthy();
    expect(
      container
        .querySelector('.ant-upload-drag')
        ?.classList.contains('sm:!h-28'),
    ).toBe(true);
  });
});
