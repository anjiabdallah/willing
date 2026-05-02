import fs from 'fs';
import path from 'path';

const wrapLine = (line: string, maxChars: number = 100): string[] => {
  if (line.length <= maxChars) return [line];
  const words = line.split(' ');
  const result: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      result.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) result.push(current.trim());
  return result;
};

export type RecommendationCvVolunteer = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  skills: string[];
  description?: string | null | undefined;
  cv_summary_text?: string | null | undefined;
  education?: string | null | undefined;
  experience?: string[] | null | undefined;
  projects?: string[] | null | undefined;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const toCvLines = (volunteer: RecommendationCvVolunteer) => {
  const summaryLines = (volunteer.cv_summary_text ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const descriptionLines = (volunteer.description ?? '')
    .split('.')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `${line}.`);

  const profileLines = summaryLines.length > 0 ? summaryLines : descriptionLines;

  const lines: string[] = [
    `${volunteer.first_name} ${volunteer.last_name} - Curriculum Vitae`,
    `Email: ${volunteer.email}`,
    '',
    'Profile Summary',
    ...(profileLines.length > 0
      ? profileLines
      : ['Motivated community volunteer with practical collaboration skills.']),
    '',
    'Core Skills',
    ...volunteer.skills.map(skill => `- ${skill}`),
  ];

  if (volunteer.education) {
    lines.push('', 'Education', ...wrapLine(volunteer.education));
  }

  if (volunteer.experience && volunteer.experience.length > 0) {
    lines.push('', 'Experience');
    for (const e of volunteer.experience) {
      lines.push(...wrapLine(`- ${e}`));
    }
  }

  if (volunteer.projects && volunteer.projects.length > 0) {
    lines.push('', 'Projects');
    for (const p of volunteer.projects) {
      lines.push(...wrapLine(`- ${p}`));
    }
  }

  return lines;
};

const buildPdf = (lines: string[]) => {
  const textLines = lines.slice(0, 42);
  const textBody = textLines
    .map((line, index) => {
      const escaped = escapePdfText(line);
      if (index === 0) return `(${escaped}) Tj`;
      return `0 -14 Td\n(${escaped}) Tj`;
    })
    .join('\n');

  const contentStream = `BT\n/F1 11 Tf\n50 770 Td\n${textBody}\nET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
};

export const buildRecommendationCvFileName = (volunteer: Pick<RecommendationCvVolunteer, 'id' | 'first_name' | 'last_name'>) =>
  `vol-${String(volunteer.id).padStart(3, '0')}-${slugify(`${volunteer.first_name}-${volunteer.last_name}`)}.pdf`;

export const writeRecommendationCvPdf = async (absolutePath: string, volunteer: RecommendationCvVolunteer) => {
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  const pdf = buildPdf(toCvLines(volunteer));
  await fs.promises.writeFile(absolutePath, pdf);
};
