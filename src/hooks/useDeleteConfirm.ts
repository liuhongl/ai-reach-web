import type { ModalFuncProps } from 'antd';
import { useCallback } from 'react';

type ConfirmModalApi = {
  confirm: (config: ModalFuncProps) => unknown;
};

type MessageApi = {
  success: (content: string) => unknown;
};

export type DeleteConfirmConfig<T> = {
  records: T[];
  entityName: string;
  unit?: string;
  getName: (record: T) => number | string | null | undefined;
  description: string;
  batchDescription?: string;
  onConfirm: (records: T[]) => Promise<void> | void;
  onSuccess?: () => void;
  successMessage?: string;
};

const toText = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === '' ? '-' : value;

export const useDeleteConfirm = ({
  modal,
  messageApi,
}: {
  modal: ConfirmModalApi;
  messageApi?: MessageApi;
}) =>
  useCallback(
    <T>({
      records,
      entityName,
      unit = '条',
      getName,
      description,
      batchDescription,
      onConfirm,
      onSuccess,
      successMessage = '删除成功',
    }: DeleteConfirmConfig<T>) => {
      if (records.length === 0) return;

      const isSingle = records.length === 1;

      modal.confirm({
        title: isSingle
          ? `删除${entityName}`
          : `删除 ${records.length} ${unit}${entityName}`,
        content: isSingle
          ? `确定删除「${toText(getName(records[0]))}」吗？${description}`
          : `确定删除选中的 ${records.length} ${unit}${entityName}吗？${batchDescription || description}`,
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        autoFocusButton: 'cancel',
        onOk: async () => {
          await onConfirm(records);
          messageApi?.success(successMessage);
          onSuccess?.();
        },
      });
    },
    [messageApi, modal],
  );
