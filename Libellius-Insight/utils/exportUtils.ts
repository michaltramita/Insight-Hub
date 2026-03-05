import * as XLSX from 'xlsx';

/**
 * Vyexportuje konkrétny HTML blok do PDF pomocou natívneho prehliadačového okna.
 * Obsahuje optimalizácie pre tlač na šírku (Landscape) a zabránenie sekaniu prvkov.
 */
export const exportBlockToPDF = (blockId: string, fileName: string, callback?: () => void) => {
  // Zavoláme callback (napr. na zavretie menu) pred tlačou
  if (callback) callback();
  
  setTimeout(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      /* 1. Nastavenie formátu strany na šírku (Landscape) a malých okrajov */
      @page {
        size: A4 landscape;
        margin: 10mm;
      }

      @media print {
        /* Skryjeme všetko ostatné */
        body * { visibility: hidden !important; }
        
        /* Zobrazíme len náš vybraný blok */
        #${blockId}, #${blockId} * { visibility: visible !important; }
        
        /* Resetneme telo stránky, aby neposúvalo náš blok */
        body {
          margin: 0 !important;
          padding: 0 !important;
        }

        /* 2. Umiestnime blok hore, roztiahneme na 100% a odstránime tiene pre čistejšie PDF */
        #${blockId} { 
          position: absolute !important; 
          left: 0 !important; 
          top: 0 !important; 
          width: 100% !important;
          max-width: 100vw !important;
          margin: 0 !important; 
          padding: 0 !important; 
          box-shadow: none !important;
        }

        /* 3. ZABRÁNENIE ROZSEKNUTIU GRAFOV A TABULIEK */
        table, tr, td, th, 
        .recharts-wrapper, 
        svg, 
        .bg-white, 
        .rounded-2xl, 
        .rounded-3xl {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        /* Vynútime, aby nadpisy nezostali samé na konci strany */
        h2, h3, h4 {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }

        /* Skryjeme exportovacie tlačidlá z PDF */
        .export-buttons { display: none !important; }

        /* Vypneme všetky tiene pre rýchlejšie generovanie PDF */
        * {
          box-shadow: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Zmeníme názov dokumentu, aby sa PDF uložilo s pekným názvom
    const originalTitle = document.title;
    document.title = fileName;
    
    // Vyvoláme okno tlače
    window.print();
    
    // Upraceme po sebe
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
