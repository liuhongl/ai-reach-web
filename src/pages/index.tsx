import * as React from 'react';
import { Result } from 'antd';
import { history, useModel } from '@umijs/max';
import { getFirstAiCallPath } from '@/aiCallNavigation';

export default function IndexPage() {
  const { initialState } = useModel('@@initialState') as {
    initialState?: { currentUser?: API.CurrentUser };
  };
  const firstPath = getFirstAiCallPath(
    initialState?.currentUser?.permissions ?? [],
  );

  React.useEffect(() => {
    if (firstPath) history.replace(firstPath);
  }, [firstPath]);

  if (firstPath) return null;
  return <Result status="403" title="403" subTitle="无权访问 AI Reach" />;
}
