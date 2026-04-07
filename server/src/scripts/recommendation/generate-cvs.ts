import fs from 'fs';
import path from 'path';

import zod from 'zod';

import {
  buildRecommendationCvFileName,
  writeRecommendationCvPdf,
} from '../data/recommendation/cvPdf.ts';

const DATASET_PATH = path.resolve('src/scripts/data/recommendation/dataset.json');
const CV_DIR = path.resolve('src/scripts/data/recommendation/cv');
const TARGET_START_ID = 21;

const volunteerSchema = zod.object({
  id: zod.number().int().positive(),
  first_name: zod.string().min(1),
  last_name: zod.string().min(1),
  email: zod.email(),
  gender: zod.enum(['male', 'female', 'other']),
  date_of_birth: zod.string().min(1),
  skills: zod.array(zod.string().min(1)),
  description: zod.string().optional(),
  cv_summary_text: zod.string().optional(),
  cv_pdf_path: zod.string().min(1),
}).passthrough();

const datasetSchema = zod.object({
  volunteers: zod.array(volunteerSchema),
}).passthrough();

type Dataset = zod.infer<typeof datasetSchema>;

const loadDataset = (): Dataset => {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset not found: ${DATASET_PATH}`);
  }
  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  return datasetSchema.parse(JSON.parse(raw));
};

const saveDataset = (dataset: Dataset) => {
  fs.writeFileSync(DATASET_PATH, `${JSON.stringify(dataset, null, 4)}\n`, 'utf8');
};

const run = async () => {
  const dataset = loadDataset();
  await fs.promises.mkdir(CV_DIR, { recursive: true });

  let generatedCount = 0;
  for (const volunteer of dataset.volunteers) {
    if (volunteer.id < TARGET_START_ID) continue;

    const fileName = buildRecommendationCvFileName(volunteer);
    const absolutePath = path.join(CV_DIR, fileName);
    const relativePath = `server/src/scripts/data/recommendation/cv/${fileName}`;

    await writeRecommendationCvPdf(absolutePath, volunteer);

    volunteer.cv_pdf_path = relativePath;
    generatedCount += 1;
  }

  saveDataset(dataset);
  console.log(`Generated ${generatedCount} recommendation CV PDFs in ${CV_DIR}`);
};

run().catch((error) => {
  console.error('Failed to generate recommendation CV PDFs:', error);
  process.exitCode = 1;
});
