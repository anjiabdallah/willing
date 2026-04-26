export const MAX_CERTIFICATE_ORGANIZATIONS = 4;
export const CERTIFICATE_PREVIEW_WIDTH = 1123;
export const CERTIFICATE_PREVIEW_HEIGHT = 794;

export type CertificatePreviewOrganization = {
  id: number;
  name: string;
  hours: number;
  logo_path: string | null;
  signatory_name: string | null;
  signatory_position: string | null;
  signature_path: string | null;
};

export type CertificatePreviewPlatformCertificate = {
  signatory_name: string | null;
  signatory_position: string | null;
  signature_path: string | null;
} | null;

export const getCertificatePreviewStyles = (previewId: string, includePrint: boolean) => `
  #${previewId} .certificate-title {
    font-size: 72px;
    line-height: 0.95;
    font-weight: 800;
    margin-top: 6px;
  }

  #${previewId} .certificate-subtitle {
    font-size: 54px;
    line-height: 1.1;
  }

  #${previewId} .certificate-name {
    font-size: 58px;
    margin-top: 8px;
    line-height: 1.05;
  }

  #${previewId} .certificate-main-copy {
    font-size: 31px;
    margin-top: 10px;
    line-height: 1.35;
  }

  #${previewId} .certificate-token-value {
    user-select: text;
    -webkit-user-select: text;
  }

  ${includePrint
    ? `
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }

          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm;
            height: 210mm;
            max-width: 297mm !important;
            max-height: 210mm !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          .certificate-preview-viewport,
          .certificate-preview-stage,
          .certificate-preview-scaler {
            width: auto !important;
            height: auto !important;
            min-width: 0 !important;
            min-height: 0 !important;
            transform: none !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden;
          }

          #${previewId},
          #${previewId} * {
            visibility: visible;
          }

          #${previewId} {
            position: fixed;
            left: 0;
            top: 0;
            width: 297mm;
            height: 210mm;
            max-height: 210mm;
            box-sizing: border-box;
            padding: 8mm 10mm 8mm;
            margin: 0;
            overflow: hidden;
            background: #fff !important;
            color: #111 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .certificate-slot {
            border: 1px solid #ddd !important;
            min-height: 18mm !important;
          }

          .certificate-sign-line {
            border-bottom: none !important;
            height: 1px !important;
            background: #222 !important;
          }

          .certificate-meta p {
            white-space: nowrap !important;
          }

          .certificate-token-value {
            user-select: text !important;
            -webkit-user-select: text !important;
          }

          .certificate-name {
            font-size: 56px !important;
            margin-top: 8px !important;
            line-height: 1.05 !important;
          }

          .certificate-main-copy {
            font-size: 30px !important;
            margin-top: 10px !important;
            line-height: 1.35 !important;
          }

          .certificate-org-section {
            margin-top: 2px !important;
            min-height: 0 !important;
          }

          .certificate-footer {
            margin-top: 6px !important;
            padding-bottom: 0 !important;
            break-inside: avoid !important;
          }

          .certificate-footer * {
            color: #111 !important;
          }

          .certificate-title {
            font-size: 70px !important;
            line-height: 0.95 !important;
          }

          .certificate-subtitle {
            font-size: 52px !important;
            line-height: 1.1 !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `
    : ''}
`;
