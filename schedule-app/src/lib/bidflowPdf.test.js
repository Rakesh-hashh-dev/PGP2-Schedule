import { describe, it, expect, vi } from 'vitest';
import { generateBidFlowPdfHtml, exportBidFlowPdf } from './bidflowPdf.js';

describe('bidflowPdf', () => {
  const sampleCourseMap = {
    FME: { code: 'FME', name: 'Financial Modeling & Equity Valuation', area: 'F&A', credits: 3.0, faculty: 'Prof. A. Kumar' },
    DM: { code: 'DM', name: 'Digital Marketing', area: 'MKTG', credits: 3.0, faculty: 'Prof. S. Roy' },
    SOM: { code: 'SOM', name: 'Service Operations', area: 'OPS', credits: 1.5, faculty: 'Prof. M. Patel' },
  };

  describe('generateBidFlowPdfHtml', () => {
    it('generates HTML with header, metadata, and student details', () => {
      const html = generateBidFlowPdfHtml({
        plan: { primary: ['FME', 'DM'], backup: ['SOM'] },
        courseMap: sampleCourseMap,
        cohortName: 'PGP1',
        termName: 'Term IV',
        minCredits: 15,
        maxCredits: 21,
        studentName: 'Aarav Gupta',
        rulesText: 'Maximum 21 credits allowed.',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>TermFlow · BidFlow Elective Plan</title>');
      expect(html).toContain('aria-label="TermFlow"');
      expect(html).toContain('background: #faf7f0');
      expect(html).toContain('counter(page) " / " counter(pages)');
      expect(html).toContain('Aarav Gupta');
      expect(html).toContain('PGP1');
      expect(html).toContain('Term IV subtotal');
      expect(html).toContain('Financial Modeling &amp; Equity Valuation');
      expect(html).toContain('Digital Marketing');
      expect(html).toContain('Backup / Alternate Electives');
      expect(html).toContain('Service Operations');
      expect(html).toContain('Maximum 21 credits allowed.');
      expect(html).toContain('F&amp;A');
      expect(html).toContain('@page {');
    });

    it('handles empty plan gracefully', () => {
      const html = generateBidFlowPdfHtml({
        plan: { primary: [], backup: [] },
        courseMap: {},
      });

      expect(html).toContain('No primary electives selected');
      expect(html).not.toContain('Backup / Alternate Electives');
    });

    it('flags compliance status when credits fall outside target boundaries', () => {
      const underHtml = generateBidFlowPdfHtml({
        plan: { primary: ['FME'] }, // 3.0 cr, min is 15
        courseMap: sampleCourseMap,
        minCredits: 15,
        maxCredits: 21,
      });

      expect(underHtml).toContain('Under Minimum');
      expect(underHtml).toContain('12.0 cr short');
    });
  });

  describe('exportBidFlowPdf', () => {
    it('returns safely if document is undefined', () => {
      const savedDoc = globalThis.document;
      delete globalThis.document;
      expect(() => exportBidFlowPdf({})).not.toThrow();
      if (savedDoc) globalThis.document = savedDoc;
    });

    it('creates a hidden iframe and injects html when document exists', () => {
      const mockDoc = { open: vi.fn(), write: vi.fn(), close: vi.fn() };
      const mockIframe = {
        style: {},
        setAttribute: vi.fn(),
        contentWindow: { document: mockDoc, focus: vi.fn(), print: vi.fn() },
      };
      const mockBody = { appendChild: vi.fn(), removeChild: vi.fn() };

      globalThis.document = {
        createElement: vi.fn(() => mockIframe),
        body: mockBody,
      };

      exportBidFlowPdf({
        plan: { primary: ['FME'] },
        courseMap: sampleCourseMap,
      });

      expect(globalThis.document.createElement).toHaveBeenCalledWith('iframe');
      expect(mockBody.appendChild).toHaveBeenCalledWith(mockIframe);
      expect(mockDoc.open).toHaveBeenCalled();
      expect(mockDoc.write).toHaveBeenCalled();
      expect(mockDoc.close).toHaveBeenCalled();

      delete globalThis.document;
    });
  });
});
