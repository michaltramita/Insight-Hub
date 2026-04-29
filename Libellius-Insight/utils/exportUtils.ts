import { Workbook } from 'exceljs';

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
  if (callback) callback();

  void (async () => {
    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Dáta');
      const headers = Object.keys(dataToExport[0] || {});

      if (headers.length === 0) {
        alert('Žiadne dáta na export.');
        return;
      }

      worksheet.addRow(headers);
      worksheet.getRow(1).font = { bold: true };

      dataToExport.forEach((row) => {
        worksheet.addRow(
          headers.map((header) => {
            const value = row?.[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'number' || typeof value === 'boolean') return value;
            return String(value);
          })
        );
      });

      headers.forEach((header, index) => {
        const maxLen = Math.min(
          60,
          Math.max(
            12,
            header.length + 2,
            ...dataToExport.map((row) => String(row?.[header] ?? '').length + 2)
          )
        );
        worksheet.getColumn(index + 1).width = maxLen;
      });

      const output = await workbook.xlsx.writeBuffer();
      const blob = new Blob([output], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Chyba pri exporte do Excelu:', error);
      alert('Nepodarilo sa vytvoriť Excel export. Skúste to znova.');
    }
  })();
};

/**
 * Vyexportuje HTML blok ako obrázok PNG vysokej kvality.
 */
export const exportBlockToPNG = async (elementId: string, fileName: string, callback?: () => void) => {
  if (callback) callback();

  setTimeout(async () => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        logging: false,
        scale: 3,
        useCORS: true,
        ignoreElements: (node: Element) => {
          if (node instanceof HTMLElement && node.classList && node.classList.contains('print:hidden')) {
            return true;
          }
          return false;
        },
      });
      const dataUrl = canvas.toDataURL('image/png');
      
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
