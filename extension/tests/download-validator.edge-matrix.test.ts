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
  },  {
    name: 'valid docs googleusercontent host 1',
    url: 'https://doc-0b-15-docs.googleusercontent.com/downloads/file1.pdf',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 2',
    url: 'https://doc-0c-16-docs.googleusercontent.com/downloads/file2.pdf',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 3',
    url: 'https://doc-0d-17-docs.googleusercontent.com/downloads/file3.pdf',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 4',
    url: 'https://doc-0e-18-docs.googleusercontent.com/downloads/file4.pdf',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 5',
    url: 'https://doc-0f-19-docs.googleusercontent.com/downloads/file5.pdf',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 6',
    url: 'https://doc-10-1a-docs.googleusercontent.com/downloads/file6.pdf',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 7',
    url: 'https://doc-11-1b-docs.googleusercontent.com/downloads/file7.pdf',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 8',
    url: 'https://doc-12-1c-docs.googleusercontent.com/downloads/file8.pdf',
    expectedValid: true,
  },  {
    name: 'valid docs googleusercontent host 9',
    url: 'https://doc-13-1d-docs.googleusercontent.com/downloads/file9.pdf',
    expectedValid: true,
  },  {
    name: 'invalid http scheme 0',
    url: 'http://drive.google.com/file/d/1bad0/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 1',
    url: 'http://drive.google.com/file/d/1bad1/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 2',
    url: 'http://drive.google.com/file/d/1bad2/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 3',
    url: 'http://drive.google.com/file/d/1bad3/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 4',
    url: 'http://drive.google.com/file/d/1bad4/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 5',
    url: 'http://drive.google.com/file/d/1bad5/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 6',
    url: 'http://drive.google.com/file/d/1bad6/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 7',
    url: 'http://drive.google.com/file/d/1bad7/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 8',
    url: 'http://drive.google.com/file/d/1bad8/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid http scheme 9',
    url: 'http://drive.google.com/file/d/1bad9/view',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 0',
    url: 'ftp://docs.google.com/document/d/1bad0/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 1',
    url: 'ftp://docs.google.com/document/d/1bad1/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 2',
    url: 'ftp://docs.google.com/document/d/1bad2/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 3',
    url: 'ftp://docs.google.com/document/d/1bad3/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 4',
    url: 'ftp://docs.google.com/document/d/1bad4/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 5',
    url: 'ftp://docs.google.com/document/d/1bad5/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 6',
    url: 'ftp://docs.google.com/document/d/1bad6/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 7',
    url: 'ftp://docs.google.com/document/d/1bad7/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 8',
    url: 'ftp://docs.google.com/document/d/1bad8/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid ftp scheme 9',
    url: 'ftp://docs.google.com/document/d/1bad9/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },  {
    name: 'invalid non-google host 0',
    url: 'https://evil0.example.com/file/d/1bad0/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 1',
    url: 'https://evil1.example.com/file/d/1bad1/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 2',
    url: 'https://evil2.example.com/file/d/1bad2/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 3',
    url: 'https://evil3.example.com/file/d/1bad3/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 4',
    url: 'https://evil4.example.com/file/d/1bad4/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 5',
    url: 'https://evil5.example.com/file/d/1bad5/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 6',
    url: 'https://evil6.example.com/file/d/1bad6/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 7',
    url: 'https://evil7.example.com/file/d/1bad7/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 8',
    url: 'https://evil8.example.com/file/d/1bad8/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid non-google host 9',
    url: 'https://evil9.example.com/file/d/1bad9/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },  {
    name: 'invalid unexpected shape on drive host 0',
    url: 'https://drive.google.com/drive/folders/1folder0',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 1',
    url: 'https://drive.google.com/drive/folders/1folder1',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 2',
    url: 'https://drive.google.com/drive/folders/1folder2',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 3',
    url: 'https://drive.google.com/drive/folders/1folder3',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 4',
    url: 'https://drive.google.com/drive/folders/1folder4',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 5',
    url: 'https://drive.google.com/drive/folders/1folder5',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 6',
    url: 'https://drive.google.com/drive/folders/1folder6',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 7',
    url: 'https://drive.google.com/drive/folders/1folder7',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 8',
    url: 'https://drive.google.com/drive/folders/1folder8',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid unexpected shape on drive host 9',
    url: 'https://drive.google.com/drive/folders/1folder9',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },  {
    name: 'invalid suspicious encoded percent 0',
    url: 'https://drive.google.com/file/d/1enc0%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 1',
    url: 'https://drive.google.com/file/d/1enc1%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 2',
    url: 'https://drive.google.com/file/d/1enc2%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 3',
    url: 'https://drive.google.com/file/d/1enc3%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 4',
    url: 'https://drive.google.com/file/d/1enc4%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 5',
    url: 'https://drive.google.com/file/d/1enc5%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 6',
    url: 'https://drive.google.com/file/d/1enc6%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 7',
    url: 'https://drive.google.com/file/d/1enc7%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 8',
    url: 'https://drive.google.com/file/d/1enc8%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious encoded percent 9',
    url: 'https://drive.google.com/file/d/1enc9%252Fview',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 0',
    url: 'https://drive.google.com/file/d/../../etc/passwd0',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 1',
    url: 'https://drive.google.com/file/d/../../etc/passwd1',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 2',
    url: 'https://drive.google.com/file/d/../../etc/passwd2',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 3',
    url: 'https://drive.google.com/file/d/../../etc/passwd3',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 4',
    url: 'https://drive.google.com/file/d/../../etc/passwd4',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 5',
    url: 'https://drive.google.com/file/d/../../etc/passwd5',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 6',
    url: 'https://drive.google.com/file/d/../../etc/passwd6',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 7',
    url: 'https://drive.google.com/file/d/../../etc/passwd7',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 8',
    url: 'https://drive.google.com/file/d/../../etc/passwd8',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid suspicious traversal 9',
    url: 'https://drive.google.com/file/d/../../etc/passwd9',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'valid mixed route bundle 0',
    url: 'https://docs.google.com/document/d/1mix0/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 1',
    url: 'https://docs.google.com/document/d/1mix1/export?format=pdf&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 2',
    url: 'https://docs.google.com/document/d/1mix2/export?format=pdf&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 3',
    url: 'https://docs.google.com/document/d/1mix3/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 4',
    url: 'https://docs.google.com/document/d/1mix4/export?format=pdf&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 5',
    url: 'https://docs.google.com/document/d/1mix5/export?format=pdf&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 6',
    url: 'https://docs.google.com/document/d/1mix6/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 7',
    url: 'https://docs.google.com/document/d/1mix7/export?format=pdf&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 8',
    url: 'https://docs.google.com/document/d/1mix8/export?format=pdf&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 9',
    url: 'https://docs.google.com/document/d/1mix9/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 10',
    url: 'https://docs.google.com/document/d/1mix10/export?format=pdf&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 11',
    url: 'https://docs.google.com/document/d/1mix11/export?format=pdf&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 12',
    url: 'https://docs.google.com/document/d/1mix12/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 13',
    url: 'https://docs.google.com/document/d/1mix13/export?format=pdf&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 14',
    url: 'https://docs.google.com/document/d/1mix14/export?format=pdf&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 15',
    url: 'https://docs.google.com/document/d/1mix15/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 16',
    url: 'https://docs.google.com/document/d/1mix16/export?format=pdf&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 17',
    url: 'https://docs.google.com/document/d/1mix17/export?format=pdf&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 18',
    url: 'https://docs.google.com/document/d/1mix18/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 19',
    url: 'https://docs.google.com/document/d/1mix19/export?format=pdf&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 20',
    url: 'https://docs.google.com/document/d/1mix20/export?format=pdf&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 21',
    url: 'https://docs.google.com/document/d/1mix21/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 22',
    url: 'https://docs.google.com/document/d/1mix22/export?format=pdf&authuser=1',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 23',
    url: 'https://docs.google.com/document/d/1mix23/export?format=pdf&authuser=2',
    expectedValid: true,
  },  {
    name: 'valid mixed route bundle 24',
    url: 'https://docs.google.com/document/d/1mix24/export?format=pdf&authuser=0',
    expectedValid: true,
  },  {
    name: 'invalid mixed hostile bundle 0',
    url: 'https://drive.google.com/file/d/1mixbad0/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 1',
    url: 'https://drive.google.com/file/d/1mixbad1/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 2',
    url: 'https://drive.google.com/file/d/1mixbad2/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 3',
    url: 'https://drive.google.com/file/d/1mixbad3/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 4',
    url: 'https://drive.google.com/file/d/1mixbad4/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 5',
    url: 'https://drive.google.com/file/d/1mixbad5/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 6',
    url: 'https://drive.google.com/file/d/1mixbad6/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 7',
    url: 'https://drive.google.com/file/d/1mixbad7/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 8',
    url: 'https://drive.google.com/file/d/1mixbad8/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 9',
    url: 'https://drive.google.com/file/d/1mixbad9/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 10',
    url: 'https://drive.google.com/file/d/1mixbad10/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 11',
    url: 'https://drive.google.com/file/d/1mixbad11/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 12',
    url: 'https://drive.google.com/file/d/1mixbad12/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 13',
    url: 'https://drive.google.com/file/d/1mixbad13/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 14',
    url: 'https://drive.google.com/file/d/1mixbad14/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 15',
    url: 'https://drive.google.com/file/d/1mixbad15/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 16',
    url: 'https://drive.google.com/file/d/1mixbad16/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 17',
    url: 'https://drive.google.com/file/d/1mixbad17/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 18',
    url: 'https://drive.google.com/file/d/1mixbad18/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 19',
    url: 'https://drive.google.com/file/d/1mixbad19/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 20',
    url: 'https://drive.google.com/file/d/1mixbad20/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 21',
    url: 'https://drive.google.com/file/d/1mixbad21/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 22',
    url: 'https://drive.google.com/file/d/1mixbad22/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 23',
    url: 'https://drive.google.com/file/d/1mixbad23/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },  {
    name: 'invalid mixed hostile bundle 24',
    url: 'https://drive.google.com/file/d/1mixbad24/..%252f..%252fsecret',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },
  {
    name: 'invalid http drive file account 0',
    url: 'http://drive.google.com/u/0/file/d/1http0/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 1',
    url: 'http://drive.google.com/u/1/file/d/1http1/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 2',
    url: 'http://drive.google.com/u/2/file/d/1http2/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 3',
    url: 'http://drive.google.com/u/3/file/d/1http3/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 4',
    url: 'http://drive.google.com/u/4/file/d/1http4/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 5',
    url: 'http://drive.google.com/u/0/file/d/1http5/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 6',
    url: 'http://drive.google.com/u/1/file/d/1http6/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 7',
    url: 'http://drive.google.com/u/2/file/d/1http7/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 8',
    url: 'http://drive.google.com/u/3/file/d/1http8/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 9',
    url: 'http://drive.google.com/u/4/file/d/1http9/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 10',
    url: 'http://drive.google.com/u/0/file/d/1http10/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 11',
    url: 'http://drive.google.com/u/1/file/d/1http11/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 12',
    url: 'http://drive.google.com/u/2/file/d/1http12/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 13',
    url: 'http://drive.google.com/u/3/file/d/1http13/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 14',
    url: 'http://drive.google.com/u/4/file/d/1http14/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 15',
    url: 'http://drive.google.com/u/0/file/d/1http15/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 16',
    url: 'http://drive.google.com/u/1/file/d/1http16/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 17',
    url: 'http://drive.google.com/u/2/file/d/1http17/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 18',
    url: 'http://drive.google.com/u/3/file/d/1http18/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid http drive file account 19',
    url: 'http://drive.google.com/u/4/file/d/1http19/view?usp=drivesdk',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 0',
    url: 'ftp://docs.google.com/document/d/1ftp0/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 1',
    url: 'ftp://docs.google.com/document/d/1ftp1/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 2',
    url: 'ftp://docs.google.com/document/d/1ftp2/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 3',
    url: 'ftp://docs.google.com/document/d/1ftp3/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 4',
    url: 'ftp://docs.google.com/document/d/1ftp4/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 5',
    url: 'ftp://docs.google.com/document/d/1ftp5/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 6',
    url: 'ftp://docs.google.com/document/d/1ftp6/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 7',
    url: 'ftp://docs.google.com/document/d/1ftp7/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 8',
    url: 'ftp://docs.google.com/document/d/1ftp8/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 9',
    url: 'ftp://docs.google.com/document/d/1ftp9/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 10',
    url: 'ftp://docs.google.com/document/d/1ftp10/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 11',
    url: 'ftp://docs.google.com/document/d/1ftp11/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 12',
    url: 'ftp://docs.google.com/document/d/1ftp12/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 13',
    url: 'ftp://docs.google.com/document/d/1ftp13/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 14',
    url: 'ftp://docs.google.com/document/d/1ftp14/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 15',
    url: 'ftp://docs.google.com/document/d/1ftp15/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 16',
    url: 'ftp://docs.google.com/document/d/1ftp16/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 17',
    url: 'ftp://docs.google.com/document/d/1ftp17/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 18',
    url: 'ftp://docs.google.com/document/d/1ftp18/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid ftp docs export 19',
    url: 'ftp://docs.google.com/document/d/1ftp19/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'INVALID_SCHEME',
  },
  {
    name: 'invalid disallowed host mirror 0',
    url: 'https://drive-google-com.evil.example/file/d/1host0/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 1',
    url: 'https://drive-google-com.evil.example/file/d/1host1/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 2',
    url: 'https://drive-google-com.evil.example/file/d/1host2/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 3',
    url: 'https://drive-google-com.evil.example/file/d/1host3/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 4',
    url: 'https://drive-google-com.evil.example/file/d/1host4/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 5',
    url: 'https://drive-google-com.evil.example/file/d/1host5/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 6',
    url: 'https://drive-google-com.evil.example/file/d/1host6/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 7',
    url: 'https://drive-google-com.evil.example/file/d/1host7/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 8',
    url: 'https://drive-google-com.evil.example/file/d/1host8/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 9',
    url: 'https://drive-google-com.evil.example/file/d/1host9/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 10',
    url: 'https://drive-google-com.evil.example/file/d/1host10/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 11',
    url: 'https://drive-google-com.evil.example/file/d/1host11/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 12',
    url: 'https://drive-google-com.evil.example/file/d/1host12/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 13',
    url: 'https://drive-google-com.evil.example/file/d/1host13/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 14',
    url: 'https://drive-google-com.evil.example/file/d/1host14/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 15',
    url: 'https://drive-google-com.evil.example/file/d/1host15/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 16',
    url: 'https://drive-google-com.evil.example/file/d/1host16/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 17',
    url: 'https://drive-google-com.evil.example/file/d/1host17/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 18',
    url: 'https://drive-google-com.evil.example/file/d/1host18/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid disallowed host mirror 19',
    url: 'https://drive-google-com.evil.example/file/d/1host19/view',
    expectedValid: false,
    expectedReasonContains: 'DISALLOWED_HOST',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 0',
    url: 'https://drive.google.com/thumbnail?id=1thumb0&sz=w0',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 1',
    url: 'https://drive.google.com/thumbnail?id=1thumb1&sz=w1',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 2',
    url: 'https://drive.google.com/thumbnail?id=1thumb2&sz=w2',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 3',
    url: 'https://drive.google.com/thumbnail?id=1thumb3&sz=w3',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 4',
    url: 'https://drive.google.com/thumbnail?id=1thumb4&sz=w4',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 5',
    url: 'https://drive.google.com/thumbnail?id=1thumb5&sz=w5',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 6',
    url: 'https://drive.google.com/thumbnail?id=1thumb6&sz=w6',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 7',
    url: 'https://drive.google.com/thumbnail?id=1thumb7&sz=w7',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 8',
    url: 'https://drive.google.com/thumbnail?id=1thumb8&sz=w8',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 9',
    url: 'https://drive.google.com/thumbnail?id=1thumb9&sz=w9',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 10',
    url: 'https://drive.google.com/thumbnail?id=1thumb10&sz=w10',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 11',
    url: 'https://drive.google.com/thumbnail?id=1thumb11&sz=w11',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 12',
    url: 'https://drive.google.com/thumbnail?id=1thumb12&sz=w12',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 13',
    url: 'https://drive.google.com/thumbnail?id=1thumb13&sz=w13',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 14',
    url: 'https://drive.google.com/thumbnail?id=1thumb14&sz=w14',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 15',
    url: 'https://drive.google.com/thumbnail?id=1thumb15&sz=w15',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 16',
    url: 'https://drive.google.com/thumbnail?id=1thumb16&sz=w16',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 17',
    url: 'https://drive.google.com/thumbnail?id=1thumb17&sz=w17',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 18',
    url: 'https://drive.google.com/thumbnail?id=1thumb18&sz=w18',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid unexpected shape drive thumbnail 19',
    url: 'https://drive.google.com/thumbnail?id=1thumb19&sz=w19',
    expectedValid: false,
    expectedReasonContains: 'UNEXPECTED_URL_SHAPE',
  },
  {
    name: 'invalid suspicious encoding docs traversal 0',
    url: 'https://docs.google.com/document/d/1enc0/..%252fsecret/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },
  {
    name: 'invalid suspicious encoding docs traversal 1',
    url: 'https://docs.google.com/document/d/1enc1/..%252fsecret/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },
  {
    name: 'invalid suspicious encoding docs traversal 2',
    url: 'https://docs.google.com/document/d/1enc2/..%252fsecret/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },
  {
    name: 'invalid suspicious encoding docs traversal 3',
    url: 'https://docs.google.com/document/d/1enc3/..%252fsecret/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },
  {
    name: 'invalid suspicious encoding docs traversal 4',
    url: 'https://docs.google.com/document/d/1enc4/..%252fsecret/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },
  {
    name: 'invalid suspicious encoding docs traversal 5',
    url: 'https://docs.google.com/document/d/1enc5/..%252fsecret/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
  },
  {
    name: 'invalid suspicious encoding docs traversal 6',
    url: 'https://docs.google.com/document/d/1enc6/..%252fsecret/export?format=pdf',
    expectedValid: false,
    expectedReasonContains: 'SUSPICIOUS_ENCODING',
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
