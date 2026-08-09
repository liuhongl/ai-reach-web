export type RuoyiSerializableParams = Record<string, unknown>;

const shouldAppendValue = (value: unknown) =>
  value !== null && value !== undefined && value !== '';

export const normalizeRuoyiParams = (params: RuoyiSerializableParams = {}) => {
  const result: RuoyiSerializableParams = {};

  Object.keys(params).forEach((propName) => {
    const value = params[propName];
    if (!shouldAppendValue(value)) return;

    if (typeof value === 'object') {
      Object.keys(value as RuoyiSerializableParams).forEach((key) => {
        const nestedValue = (value as RuoyiSerializableParams)[key];
        if (!shouldAppendValue(nestedValue)) return;

        result[`${propName}[${key}]`] = nestedValue;
      });
      return;
    }

    result[propName] = value;
  });

  return result;
};

export const serializeRuoyiParams = (params: RuoyiSerializableParams = {}) => {
  const result: string[] = [];

  Object.entries(normalizeRuoyiParams(params)).forEach(([propName, value]) => {
    if (!shouldAppendValue(value)) return;

    result.push(
      `${encodeURIComponent(propName)}=${encodeURIComponent(String(value))}`,
    );
  });

  return result.join('&');
};

export const addRuoyiDateRange = <T extends RuoyiSerializableParams>(
  params: T,
  dateRange: [unknown, unknown] | unknown[],
  propName?: string,
) => {
  const [beginValue, endValue] = Array.isArray(dateRange) ? dateRange : [];
  const rangeParams = {
    ...(typeof params.params === 'object'
      ? (params.params as RuoyiSerializableParams)
      : {}),
    [propName ? `begin${propName}` : 'beginTime']: beginValue,
    [propName ? `end${propName}` : 'endTime']: endValue,
  };

  return {
    ...params,
    params: rangeParams,
  };
};
