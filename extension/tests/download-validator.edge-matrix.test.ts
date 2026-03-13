import { describe, expect, it } from 'vitest';
import { validateDownloadUrl } from '../src/v2/decision/download-validator';

type EdgeCase = {
  name: string;
  url: string;
  expectedValid: boolean;
  expectedReasonContains?: string;
};

const EDGE_CASES: EdgeCase[] = [
  {
    name: 'valid drive file route account 0',
    url: 'https://drive.google.com/u/0/file/d/1abcDEF0/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 1',
    url: 'https://drive.google.com/u/1/file/d/1abcDEF1/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 2',
    url: 'https://drive.google.com/u/2/file/d/1abcDEF2/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 3',
    url: 'https://drive.google.com/u/3/file/d/1abcDEF3/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 4',
    url: 'https://drive.google.com/u/4/file/d/1abcDEF4/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 5',
    url: 'https://drive.google.com/u/0/file/d/1abcDEF5/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 6',
    url: 'https://drive.google.com/u/1/file/d/1abcDEF6/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 7',
    url: 'https://drive.google.com/u/2/file/d/1abcDEF7/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 8',
    url: 'https://drive.google.com/u/3/file/d/1abcDEF8/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 9',
    url: 'https://drive.google.com/u/4/file/d/1abcDEF9/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 10',
    url: 'https://drive.google.com/u/0/file/d/1abcDEF10/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 11',
    url: 'https://drive.google.com/u/1/file/d/1abcDEF11/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 12',
    url: 'https://drive.google.com/u/2/file/d/1abcDEF12/view?usp=drivesdk',
    expectedValid: true,
  },
];

describe('download-validator edge matrix', () => {
  it.each(EDGE_CASES)('$name', ({ url, expectedValid, expectedReasonContains }) => {
    const result = validateDownloadUrl(url);
    expect(result.valid).toBe(expectedValid);
    if (expectedReasonContains) {
      expect(result.reason).toContain(expectedReasonContains);
    }
  });
});
