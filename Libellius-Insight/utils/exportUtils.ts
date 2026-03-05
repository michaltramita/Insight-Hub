import * as XLSX from 'xlsx';

/**
 * Vyexportuje konkrétny HTML blok do PDF pomocou natívneho prehliadačového okna.
 */
export const exportBlockToPDF = (blockId: string, fileName: string, callback?: () => void) => {
  // Zavoláme callback (napr. na zavretie menu) pred tlačou
  if (callback) callback();
  
  setTimeout(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #${blockId}, #${blockId} * { visibility: visible !important; }
        #${blockId} { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
        .export-buttons { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    
    const originalTitle = document.title;
    document.title = fileName;
    
    window.print();
    
    document.title = originalTitle;
    document.head.removeChild(style);
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
