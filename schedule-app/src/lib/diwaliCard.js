function loadVector(svg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not render the card artwork. Please try again.')); };
    image.src = url;
  });
}

// Freeze the actual rendered vector layers, including the temporary scarf.
// No screenshot service, external upload, or personal-data transmission.
async function drawVectors(context, element, x, y, size) {
  if (!element) return;
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const properties = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'transform', 'transform-origin', 'transform-box', 'display', 'visibility', 'clip-path', 'mask', 'filter'];
  for (const svg of element.querySelectorAll(':scope > svg')) {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const clone = svg.cloneNode(true);
    const originals = [svg, ...svg.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((original, index) => {
      const computed = getComputedStyle(original);
      properties.forEach(property => {
        // Browsers resolve local paint-server IDs against the page URL. Restore
        // fragment-only references so gradients/masks survive the SVG Blob URL.
        const value = computed.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g, 'url(#$1)');
        copies[index].style.setProperty(property, value);
      });
      copies[index].style.animation = 'none';
    });
    // Raster/external SVG references are not needed by the vector companion.
    clone.querySelectorAll('script,foreignObject,image').forEach(node => node.remove());
    clone.querySelectorAll('[href],[xlink\\:href]').forEach(node => {
      for (const attr of ['href', 'xlink:href']) if (node.hasAttribute(attr) && !node.getAttribute(attr).startsWith('#')) node.removeAttribute(attr);
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(rect.width));
    clone.setAttribute('height', String(rect.height));
    clone.style.transform = 'none'; clone.style.position = 'static';
    clone.style.width = `${rect.width}px`; clone.style.height = `${rect.height}px`;
    const image = await loadVector(new XMLSerializer().serializeToString(clone));
    context.drawImage(image, x + (rect.left - bounds.left) / bounds.width * size, y + (rect.top - bounds.top) / bounds.height * size, rect.width / bounds.width * size, rect.height / bounds.height * size);
  }
}

export async function downloadDiwaliCard({ name, companionElement, diyaElement, year }) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Card downloads are unavailable in this browser.');
  const bg = ctx.createLinearGradient(0, 0, 1200, 1200); bg.addColorStop(0, '#20192f'); bg.addColorStop(.6, '#39213c'); bg.addColorStop(1, '#743d48');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1200, 1200);
  ctx.strokeStyle = '#d8ac6d'; ctx.lineWidth = 2; ctx.strokeRect(48, 48, 1104, 1104); ctx.strokeRect(61, 61, 1078, 1078);
  // A restrained geometric border, kept away from the message.
  ctx.fillStyle = '#e1b773';
  for (let index = 0; index < 32; index++) { const angle = index * Math.PI / 16; ctx.beginPath(); ctx.arc(600 + Math.cos(angle) * 495, 600 + Math.sin(angle) * 495, index % 2 ? 2 : 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.textAlign = 'center'; ctx.fillStyle = '#e4ba7a'; ctx.font = '22px sans-serif'; ctx.fillText('TERMFLOW · A LITTLE LIGHT FOR YOUR DAY', 600, 154);
  ctx.fillStyle = '#fff0d8'; ctx.font = '84px Georgia, serif'; ctx.fillText('Happy Diwali', 600, 290);
  const sender = (name || 'A friend').trim().slice(0, 48) || 'A friend';
  let fontSize = 34; ctx.font = `${fontSize}px sans-serif`;
  while (ctx.measureText(`From ${sender}`).width > 900 && fontSize > 20) { fontSize -= 1; ctx.font = `${fontSize}px sans-serif`; }
  ctx.fillStyle = '#e8d4dc'; ctx.fillText(`From ${sender}`, 600, 353);
  await drawVectors(ctx, diyaElement, companionElement ? 370 : 470, 470, 280);
  if (companionElement) await drawVectors(ctx, companionElement, 660, 515, 200);
  ctx.fillStyle = '#fff0d8'; ctx.font = '31px Georgia, serif';
  ctx.fillText('A little light for everything', 600, 890); ctx.fillText('you’re working towards.', 600, 934);
  ctx.fillStyle = '#d2b5cb'; ctx.font = '20px sans-serif'; ctx.fillText('Made with your TermFlow companion corner', 600, 1076);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create the download. Please try again.');
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `termflow-diwali-${year}.png`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
