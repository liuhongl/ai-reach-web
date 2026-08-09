import * as React from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  PageContainer,
  type PageContainerProps,
  ProCard,
  type ProCardProps,
} from '@ant-design/pro-components';
import { Button } from 'antd';
import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export const Page = ({
  className,
  children,
  extra,
  onBack,
  ...props
}: PageContainerProps) => (
  <PageContainer
    className={clsx('recov-page', className)}
    {...props}
    pageHeaderRender={false}
  >
    {onBack || extra ? (
      <div className="recov-page-toolbar">
        <div>
          {onBack ? (
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
              返回
            </Button>
          ) : null}
        </div>
        {extra ? <div className="recov-page-toolbar-extra">{extra}</div> : null}
      </div>
    ) : null}
    {children}
  </PageContainer>
);

export const ListPage = ({ className, ...props }: PageContainerProps) => (
  <Page className={clsx('recov-list-page', className)} {...props} />
);

export const ListStack = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('recov-list-stack', className)} {...props} />
);

export const StatsStrip = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('recov-stats-strip', className)} {...props} />
);

export const TableCard = ({ className, ...props }: ProCardProps) => (
  <ProCard className={clsx('recov-table-card', className)} {...props} />
);
