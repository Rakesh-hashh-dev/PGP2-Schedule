import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadDiwaliCard } from './diwaliCard.js';

function browserDoubles({ vectorFailure = false, blobFailure = false } = {}) {
  const context = { createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, beginPath() {}, arc() {}, fill() {}, fillText: vi.fn(), measureText: text => ({ width: text.length * 20 }), drawImage: vi.fn() };
  const link = { click: vi.fn(), remove: vi.fn() };
  const canvas = { getContext: () => context, toBlob: callback => callback(blobFailure ? null : new Blob(['png'], { type: 'image/png' })) };
  const paint = vi.fn();
  const clone = { style: { setProperty: paint }, setAttribute() {}, querySelectorAll: () => [] };
  const svg = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), cloneNode: () => clone, querySelectorAll: () => [] };
  const art = { getBoundingClientRect: svg.getBoundingClientRect, querySelectorAll: () => [svg] };
  vi.stubGlobal('document', { createElement: tag => tag === 'canvas' ? canvas : link, body: { append: vi.fn() } });
  vi.stubGlobal('Image', class { set src(_url) { queueMicrotask(() => vectorFailure ? this.onerror() : this.onload()); } });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:offline-card'), revokeObjectURL: vi.fn() });
  vi.stubGlobal('XMLSerializer', class { serializeToString() { return '<svg xmlns="http://www.w3.org/2000/svg"/>'; } });
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: key => key === 'fill' ? 'url("https://termflow.test/page#gold")' : '' }));
  vi.stubGlobal('setTimeout', callback => { callback(); return 0; });
  return { context, link, art, paint };
}
afterEach(() => vi.unstubAllGlobals());
describe('local Diwali card download', () => {
  it('exports both real vector layers, fixes local gradients, and downloads a PNG', async () => {
    const { context, link, art, paint } = browserDoubles();
    await downloadDiwaliCard({ name: 'Student', companionElement: art, diyaElement: art, year: '2026' });
    expect(paint).toHaveBeenCalledWith('fill', 'url(#gold)');
    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(context.fillText).toHaveBeenCalledWith('From Student', 600, 353);
    expect(link.download).toBe('termflow-diwali-2026.png');
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
  });
  it('still downloads a greeting without enabling or inventing a companion', async () => {
    const { context, link, art } = browserDoubles();
    await downloadDiwaliCard({ name: '', diyaElement: art, year: '2026' });
    expect(context.drawImage).toHaveBeenCalledOnce();
    expect(context.fillText).toHaveBeenCalledWith('From A friend', 600, 353);
    expect(link.click).toHaveBeenCalledOnce();
  });
  it('reports vector-rendering failures without claiming a download', async () => {
    const { art, link } = browserDoubles({ vectorFailure: true });
    await expect(downloadDiwaliCard({ diyaElement: art, year: '2026' })).rejects.toThrow('artwork');
    expect(link.click).not.toHaveBeenCalled();
  });
  it('reports canvas export failure without claiming a download', async () => {
    const { link } = browserDoubles({ blobFailure: true });
    await expect(downloadDiwaliCard({ year: '2026' })).rejects.toThrow('Could not create');
    expect(link.click).not.toHaveBeenCalled();
  });
});
