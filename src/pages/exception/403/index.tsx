import * as React from 'react';
import { Result } from 'antd';

export default function ForbiddenPage() {
  return <Result status="403" title="403" subTitle="无权访问当前页面" />;
}
