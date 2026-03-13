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
  },  {
    name: 'valid drive file route account 13',
    url: 'https://drive.google.com/u/3/file/d/1abcDEF13/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 14',
    url: 'https://drive.google.com/u/4/file/d/1abcDEF14/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 15',
    url: 'https://drive.google.com/u/0/file/d/1abcDEF15/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 16',
    url: 'https://drive.google.com/u/1/file/d/1abcDEF16/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 17',
    url: 'https://drive.google.com/u/2/file/d/1abcDEF17/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 18',
    url: 'https://drive.google.com/u/3/file/d/1abcDEF18/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 19',
    url: 'https://drive.google.com/u/4/file/d/1abcDEF19/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 20',
    url: 'https://drive.google.com/u/0/file/d/1abcDEF20/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 21',
    url: 'https://drive.google.com/u/1/file/d/1abcDEF21/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 22',
    url: 'https://drive.google.com/u/2/file/d/1abcDEF22/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 23',
    url: 'https://drive.google.com/u/3/file/d/1abcDEF23/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 24',
    url: 'https://drive.google.com/u/4/file/d/1abcDEF24/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 25',
    url: 'https://drive.google.com/u/0/file/d/1abcDEF25/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 26',
    url: 'https://drive.google.com/u/1/file/d/1abcDEF26/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 27',
    url: 'https://drive.google.com/u/2/file/d/1abcDEF27/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 28',
    url: 'https://drive.google.com/u/3/file/d/1abcDEF28/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive file route account 29',
    url: 'https://drive.google.com/u/4/file/d/1abcDEF29/view?usp=drivesdk',
    expectedValid: true,
  },  {
    name: 'valid drive open route 0',
    url: 'https://drive.google.com/open?id=1open0&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid drive open route 1',
    url: 'https://drive.google.com/open?id=1open1&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid drive open route 2',
    url: 'https://drive.google.com/open?id=1open2&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid drive open route 3',
    url: 'https://drive.google.com/open?id=1open3&authuser=3',
    expectedValid: true,
  },  {
    name: 'valid drive open route 4',
    url: 'https://drive.google.com/open?id=1open4&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid drive open route 5',
    url: 'https://drive.google.com/open?id=1open5&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid drive open route 6',
    url: 'https://drive.google.com/open?id=1open6&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid drive open route 7',
    url: 'https://drive.google.com/open?id=1open7&authuser=3',
    expectedValid: true,
  },  {
    name: 'valid drive open route 8',
    url: 'https://drive.google.com/open?id=1open8&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid drive open route 9',
    url: 'https://drive.google.com/open?id=1open9&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid drive open route 10',
    url: 'https://drive.google.com/open?id=1open10&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid drive open route 11',
    url: 'https://drive.google.com/open?id=1open11&authuser=3',
    expectedValid: true,
  },  {
    name: 'valid drive open route 12',
    url: 'https://drive.google.com/open?id=1open12&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid drive open route 13',
    url: 'https://drive.google.com/open?id=1open13&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid drive open route 14',
    url: 'https://drive.google.com/open?id=1open14&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 0',
    url: 'https://drive.google.com/uc?export=download&id=1uc0&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 1',
    url: 'https://drive.google.com/uc?export=download&id=1uc1&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 2',
    url: 'https://drive.google.com/uc?export=download&id=1uc2&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 3',
    url: 'https://drive.google.com/uc?export=download&id=1uc3&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 4',
    url: 'https://drive.google.com/uc?export=download&id=1uc4&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 5',
    url: 'https://drive.google.com/uc?export=download&id=1uc5&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 6',
    url: 'https://drive.google.com/uc?export=download&id=1uc6&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 7',
    url: 'https://drive.google.com/uc?export=download&id=1uc7&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 8',
    url: 'https://drive.google.com/uc?export=download&id=1uc8&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 9',
    url: 'https://drive.google.com/uc?export=download&id=1uc9&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 10',
    url: 'https://drive.google.com/uc?export=download&id=1uc10&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 11',
    url: 'https://drive.google.com/uc?export=download&id=1uc11&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 12',
    url: 'https://drive.google.com/uc?export=download&id=1uc12&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 13',
    url: 'https://drive.google.com/uc?export=download&id=1uc13&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid drive uc route 14',
    url: 'https://drive.google.com/uc?export=download&id=1uc14&confirm=t',
    expectedValid: true,
  },  {
    name: 'valid docs document route 0',
    url: 'https://docs.google.com/u/0/document/d/1doc0/export?format=pdf',
    expectedValid: true,
  },  {
    name: 'valid docs presentation route 1',
    url: 'https://docs.google.com/u/1/presentation/d/1doc1/export/pptx',
    expectedValid: true,
  },  {
    name: 'valid docs drawings route 2',
    url: 'https://docs.google.com/u/2/drawings/d/1doc2/export/png',
    expectedValid: true,
  },  {
    name: 'valid docs document route 3',
    url: 'https://docs.google.com/u/3/document/d/1doc3/export?format=pdf',
    expectedValid: true,
  },  {
    name: 'valid docs presentation route 4',
    url: 'https://docs.google.com/u/4/presentation/d/1doc4/export/pptx',
    expectedValid: true,
  },  {
    name: 'valid docs drawings route 5',
    url: 'https://docs.google.com/u/0/drawings/d/1doc5/export/png',
    expectedValid: true,
  },  {
    name: 'valid docs document route 6',
    url: 'https://docs.google.com/u/1/document/d/1doc6/export?format=pdf',
    expectedValid: true,
  },  {
    name: 'valid docs presentation route 7',
    url: 'https://docs.google.com/u/2/presentation/d/1doc7/export/pptx',
    expectedValid: true,
  },  {
    name: 'valid docs drawings route 8',
    url: 'https://docs.google.com/u/3/drawings/d/1doc8/export/png',
    expectedValid: true,
  },  {
    name: 'valid docs document route 9',
    url: 'https://docs.google.com/u/4/document/d/1doc9/export?format=pdf',
    expectedValid: true,
  },  {
    name: 'valid docs presentation route 10',
    url: 'https://docs.google.com/u/0/presentation/d/1doc10/export/pptx',
    expectedValid: true,
  },  {
    name: 'valid docs drawings route 11',
    url: 'https://docs.google.com/u/1/drawings/d/1doc11/export/png',
    expectedValid: true,
  },  {
    name: 'valid docs document route 12',
    url: 'https://docs.google.com/u/2/document/d/1doc12/export?format=pdf',
    expectedValid: true,
  },  {
    name: 'valid docs presentation route 13',
    url: 'https://docs.google.com/u/3/presentation/d/1doc13/export/pptx',
    expectedValid: true,
  },  {
    name: 'valid docs drawings route 14',
    url: 'https://docs.google.com/u/4/drawings/d/1doc14/export/png',
    expectedValid: true,
  },  {
    name: 'valid docs document route 15',
    url: 'https://docs.google.com/u/0/document/d/1doc15/export?format=pdf',
    expectedValid: true,
  },  {
    name: 'valid docs presentation route 16',
    url: 'https://docs.google.com/u/1/presentation/d/1doc16/export/pptx',
    expectedValid: true,
  },  {
    name: 'valid docs drawings route 17',
    url: 'https://docs.google.com/u/2/drawings/d/1doc17/export/png',
    expectedValid: true,
  },  {
    name: 'valid docs document route 18',
    url: 'https://docs.google.com/u/3/document/d/1doc18/export?format=pdf',
    expectedValid: true,
  },  {
    name: 'valid docs presentation route 19',
    url: 'https://docs.google.com/u/4/presentation/d/1doc19/export/pptx',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 0',
    url: 'https://classroom.google.com/u/0/drive/file/1class0/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 1',
    url: 'https://classroom.google.com/u/1/drive/file/1class1/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 2',
    url: 'https://classroom.google.com/u/2/drive/file/1class2/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 3',
    url: 'https://classroom.google.com/u/3/drive/file/1class3/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 4',
    url: 'https://classroom.google.com/u/0/drive/file/1class4/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 5',
    url: 'https://classroom.google.com/u/1/drive/file/1class5/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 6',
    url: 'https://classroom.google.com/u/2/drive/file/1class6/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 7',
    url: 'https://classroom.google.com/u/3/drive/file/1class7/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 8',
    url: 'https://classroom.google.com/u/0/drive/file/1class8/view',
    expectedValid: true,
  },  {
    name: 'valid classroom drive proxy 9',
    url: 'https://classroom.google.com/u/1/drive/file/1class9/view',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 0',
    url: 'https://doc-0a-14-docs.googleusercontent.com/downloads/file0.pdf',
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
