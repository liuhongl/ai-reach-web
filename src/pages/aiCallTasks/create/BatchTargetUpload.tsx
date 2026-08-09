import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { Button, Upload } from 'antd';
import React from 'react';
import { validateBatchTargetFile } from './validation';

type BatchTargetUploadProps = {
  file?: File;
  downloading: boolean;
  onDownload: () => void;
  onFileChange: (file?: File) => void;
  onFileError: (errorMessage: string) => void;
};

const BatchTargetUpload = ({
  file,
  downloading,
  onDownload,
  onFileChange,
  onFileError,
}: BatchTargetUploadProps) => {
  const fileList: UploadFile[] = file
    ? [{ uid: 'selected-target-list', name: file.name, status: 'done' }]
    : [];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          icon={<DownloadOutlined />}
          loading={downloading}
          onClick={onDownload}
        >
          下载名单模板
        </Button>
      </div>
      <Upload.Dragger
        accept=".xlsx"
        beforeUpload={(nextFile) => {
          const errorMessage = validateBatchTargetFile(nextFile);
          if (errorMessage) {
            onFileError(errorMessage);
            return Upload.LIST_IGNORE;
          }
          return false;
        }}
        fileList={fileList}
        maxCount={1}
        multiple={false}
        onChange={({ fileList: nextFiles }) => {
          const selected = nextFiles.at(-1)?.originFileObj;
          onFileChange(selected);
        }}
        onRemove={() => {
          onFileChange(undefined);
          return true;
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p>上传完整外呼名单</p>
        <p className="text-gray-500">
          仅支持单个不超过 10 MB 的 xlsx；手机号必填，客户名称选填
        </p>
      </Upload.Dragger>
    </div>
  );
};

export default BatchTargetUpload;
