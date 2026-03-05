import * as XLSX from 'xlsx';

/**
 * Vyexportuje konkrétny HTML blok do PDF pomocou natívneho prehliadačového okna.
 * Optimalizované pre kompaktné zobrazenie (cca 55% mierka) na jednu stranu A4 Landscape.
 */
export const exportBlockToPDF = (blockId: string, fileName: string, callback?: () => void) => {
  // Zavoláme callback (napr. na zavretie dropdown menu v UI)
  if (callback) callback();
  
  setTimeout(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      /* 1. Definícia strany A4 na šírku */
      @page {
        size: A4 landscape;
        margin: 10mm; 
      }

      @media print {
        /* Skryjeme kompletne celú stránku */
        body * { visibility: hidden !important; }
        
        /* Zobrazíme len vybraný blok a jeho potomkov */
        #${blockId}, #${blockId} * { visibility: visible !important; }
        
        /* Resetneme nastavenia tela dokumentu pre čistý export */
        body, html {
          margin: 0 !important;
          padding: 0 !important;
          background-color: white !important;
          height: auto !important;
        }

        /* 2. MAGICKÉ ŠKÁLOVANIE (Zmenšenie na cca 55%) */
        #${blockId} { 
          position: absolute !important; 
          left: 50% !important; /* Posun do stredu */
          top: 0 !important; 
          
          /* Zafixujeme logickú šírku, aby grafy a tabuľky mali správny pomer strán */
          width: 1250px !important; 
          max-width: 1250px !important;

          /* Celý tento 1250px široký objekt zmenšíme tak, aby sa zmestil na A4 */
          /* translateX(-50%) vráti blok na stred po posune left: 50% */
          transform: translateX(-50%) scale(0.55) !important;
          transform-origin: top center !important;
          
          margin: 0 !important; 
          padding: 20px !important; 
          box-shadow: none !important;
          background-color: white !important;
        }

        /* 3. ZABRÁNENIE ROZSEKNUTIU PRVKOV */
        /* Chránime tabuľky, grafy a zaoblené boxy pred rozdelením na 2 strany */
        table, tr, td, th, 
        .recharts-wrapper, 
        .recharts-surface,
        svg,
        .bg-white, 
        .rounded-2xl, 
        .rounded-3xl,
        .rounded-\\[1\\.5rem\\],
        .rounded-\\[2rem\\] {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        /* Oprava rozloženia gridu pre tlač (vynútenie flexu tam, kde grid zlyháva) */
        .grid {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 20px !important;
        }
        
        .grid > div {
          flex: 1 1 calc(50% - 20px) !important;
          box-sizing: border-box !important;
        }
        
        /* Metriky v sekcii Zapojenie (3 stĺpce) */
        .grid-cols-1.md\\:grid-cols-3 > div {
           flex: 1 1 calc(33.333% - 20px) !important;
        }

        /* Skrytie nepotrebných prvkov v PDF */
        .export-buttons, .print\\:hidden { display: none !important; }
        
        /* Vypnutie tieňov pre ostrejší text v PDF */
        * { box-shadow: none !important; }
      }
    `;
    document.head.appendChild(style);
    
    // Nastavenie dočasného názvu dokumentu (pre uloženie PDF súboru)
    const originalTitle = document.title;
    document.title = fileName;
    
    // Vyvolanie simulovaného resize eventu pre grafy, aby sa prekreslili do PDF šírky
    window.dispatchEvent(new Event('resize'));

    setTimeout(() => {
      window.print();
      
      // Upratanie po tlači
      document.title = originalTitle;
      document.head.removeChild(style);
      window.dispatchEvent(new Event('resize'));
    }, 600); // Polsekunda na usadenie layoutu pred tlačou

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
