import fs from 'fs/promises';
import path from 'path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  buildRecommendationCvFileName,
  writeRecommendationCvPdf,
} from './cvPdf.ts';
import { createTempDir, removeTempDir } from '../../../tests/helpers/tempDir.ts';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    await removeTempDir(dir);
  }
});

describe('recommendation CV PDF utilities', () => {
  test('buildRecommendationCvFileName returns a deterministic slugged filename', () => {
    const fileName = buildRecommendationCvFileName({
      id: 21,
      first_name: 'Joelle',
      last_name: 'Abi Nader',
    });

    expect(fileName).toBe('vol-021-joelle-abi-nader.pdf');
  });

  test('writeRecommendationCvPdf writes a valid pdf file with volunteer info markers', async () => {
    const tempDir = await createTempDir();
    tempDirs.push(tempDir);
    const filePath = path.join(tempDir, 'generated-volunteer-cv.pdf');

    await writeRecommendationCvPdf(filePath, {
      id: 30,
      first_name: 'Maya',
      last_name: 'Sayegh',
      email: 'maya-sayegh@willing.social',
      skills: ['patient intake', 'coordination'],
      description: 'Supports intake workflows and communications.',
      cv_summary_text: 'Public health volunteer with clinic registration experience.',
    });

    const buffer = await fs.readFile(filePath);
    const fileText = buffer.toString('utf8');

    expect(buffer.length).toBeGreaterThan(100);
    expect(fileText.startsWith('%PDF-1.4')).toBe(true);
    expect(fileText).toContain('/Type /Catalog');
    expect(fileText).toContain('/BaseFont /Helvetica');
    expect(fileText).toContain('Maya Sayegh - Curriculum Vitae');
    expect(fileText).toContain('maya-sayegh@willing.social');
  });
});
