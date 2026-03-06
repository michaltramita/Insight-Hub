import * as XLSX from 'xlsx';

/**
 * Vyexportuje konkrétny HTML blok do PDF pomocou natívneho prehliadačového okna.
 */
export const exportBlockToPDF = (blockId: string, fileName: string, callback?: () => void) => {
  if (callback) callback();
  
  setTimeout(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @page {
        size: A4 landscape;
        margin: 10mm; 
      }
      @media print {
        body * { visibility: hidden !important; }
        #${blockId}, #${blockId} * { visibility: visible !important; }
        body, html {
          margin: 0 !important;
          padding: 0 !important;
          background-color: white !important;
          height: auto !important;
        }
        #${blockId} { 
          position: absolute !important; 
          left: 50% !important; 
          top: 0 !important; 
          width: 1250px !important; 
          max-width: 1250px !important;
          transform: translateX(-50%) scale(0.55) !important;
          transform-origin: top center !important;
          margin: 0 !important; 
          padding: 20px !important; 
          box-shadow: none !important;
          background-color: white !important;
        }
        table, tr, td, th, 
        .recharts-wrapper, .recharts-surface, svg,
        .bg-white, .rounded-2xl, .rounded-3xl,
        .rounded-\\[1\\.5rem\\], .rounded-\\[2rem\\] {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .grid { display: flex !important; flex-wrap: wrap !important; gap: 20px !important; }
        .grid > div { flex: 1 1 calc(50% - 20px) !important; box-sizing: border-box !important; }
        .grid-cols-1.md\\:grid-cols-3 > div { flex: 1 1 calc(33.333% - 20px) !important; }
        .export-buttons, .print\\:hidden { display: none !important; }
        * { box-shadow: none !important; }
      }
    `;
    document.head.appendChild(style);
    const originalTitle = document.title;
    document.title = fileName;
    window.dispatchEvent(new Event('resize'));

    setTimeout(() => {
      window.print();
      document.title = originalTitle;
      document.head.removeChild(style);
      window.dispatchEvent(new Event('resize'));
    }, 600);
  }, 100);
};

/**
 * Vyexportuje pripravené dáta do Excel súboru.
 */
export const exportDataToExcel = (dataToExport: any[], fileName: string, callback?: () => void) => {
  if (!dataToExport || dataToExport.length === 0) {
    alert('Žiadne dáta na export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dáta');
  XLSX.writeFile(workbook, fileName);
  if (callback) callback();
};

/**
 * Vyexportuje HTML blok ako obrázok PNG vysokej kvality.
 * Využíva html-to-image (natívne prehliadačové renderovanie), čím eliminuje blednutie.
 */
export const exportBlockToPNG = async (elementId: string, fileName: string, callback?: () => void) => {
  if (callback) callback();

  setTimeout(async () => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      const htmlToImage = (window as any).htmlToImage;
      
      if (!htmlToImage) {
        alert("Nástroj na export obrázkov sa ešte nenačítal. Skúste to prosím o sekundu.");
        return;
      }
      
      const dataUrl = await htmlToImage.toPng(element, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        skipFonts: false,
        style: {
          backgroundColor: '#ffffff'
        },
        filter: (node: any) => {
          if (node instanceof HTMLElement && node.classList && node.classList.contains('print:hidden')) {
            return false;
          }
          return true;
        }
      });
      
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
      
    } catch (error) {
      console.error('Chyba pri exporte do PNG:', error);
      alert('Nepodarilo sa vytvoriť obrázok. Skúste to znova.');
    }
  }, 200); 
};
