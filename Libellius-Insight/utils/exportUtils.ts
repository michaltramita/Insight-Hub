import * as XLSX from 'xlsx';

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
 * Načítava knižnicu html2canvas priamo z prehliadača (cez index.html).
 */
export const exportBlockToPNG = async (elementId: string, fileName: string, callback?: () => void) => {
  if (callback) callback();

  // Dáme UI chvíľočku (150ms), aby sa prekreslilo predtým, než ho "odfotíme"
  setTimeout(async () => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      // Potiahneme knižnicu z window (načítanú v index.html)
      const html2canvas = (window as any).html2canvas;
      
      if (!html2canvas) {
        alert("Nástroj na export obrázkov sa ešte nenačítal. Skúste to prosím o sekundu.");
        return;
      }

      // Vytvoríme "fotografiu" elementu. Scale: 2 zaručí ostré HD rozlíšenie.
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = image;
      link.click();
      
    } catch (error) {
      console.error('Chyba pri exporte do PNG:', error);
      alert('Nepodarilo sa vytvoriť obrázok. Skúste to znova.');
    }
  }, 150);
};
