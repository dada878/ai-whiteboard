import { WhiteboardData } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export class ExportService {
  // 匯出為 PNG
  static async exportAsPNG(elementId: string = 'whiteboard-canvas', fileName: string = 'whiteboard.png') {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('找不到白板元素');
      }

      // 暫時移除變形效果以獲得更好的截圖品質
      const originalTransform = element.style.transform;
      element.style.transform = 'none';

      // 獲取當前主題
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      // 使用 html2canvas 進行截圖
      const canvas = await html2canvas(element, {
        backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
        scale: 2, // 提高解析度
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          // 在克隆的文檔中替換所有 oklch 顏色
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const computedStyle = window.getComputedStyle(el as Element);
            const style = (el as HTMLElement).style;
            
            // 檢查並替換 backgroundColor
            if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('oklch')) {
              style.backgroundColor = isDarkMode ? '#1e1e1e' : '#ffffff';
            }
            
            // 檢查並替換 color
            if (computedStyle.color && computedStyle.color.includes('oklch')) {
              style.color = isDarkMode ? '#e8e8e8' : '#171717';
            }
            
            // 檢查並替換 borderColor
            if (computedStyle.borderColor && computedStyle.borderColor.includes('oklch')) {
              style.borderColor = isDarkMode ? '#484848' : '#e5e7eb';
            }
          });
        }
      });

      // 恢復原本的變形效果
      element.style.transform = originalTransform;

      // 將 canvas 轉換為 blob 並下載
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');

      return true;
    } catch (error) {
      console.error('匯出 PNG 失敗:', error);
      throw error;
    }
  }

  // 匯出為 PDF
  static async exportAsPDF(elementId: string = 'whiteboard-canvas', fileName: string = 'whiteboard.pdf') {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('找不到白板元素');
      }

      // 暫時移除變形效果
      const originalTransform = element.style.transform;
      element.style.transform = 'none';

      // 獲取當前主題
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      // 使用 html2canvas 進行截圖
      const canvas = await html2canvas(element, {
        backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          // 在克隆的文檔中替換所有 oklch 顏色
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const computedStyle = window.getComputedStyle(el as Element);
            const style = (el as HTMLElement).style;
            
            // 檢查並替換 backgroundColor
            if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('oklch')) {
              style.backgroundColor = isDarkMode ? '#1e1e1e' : '#ffffff';
            }
            
            // 檢查並替換 color
            if (computedStyle.color && computedStyle.color.includes('oklch')) {
              style.color = isDarkMode ? '#e8e8e8' : '#171717';
            }
            
            // 檢查並替換 borderColor
            if (computedStyle.borderColor && computedStyle.borderColor.includes('oklch')) {
              style.borderColor = isDarkMode ? '#484848' : '#e5e7eb';
            }
          });
        }
      });

      // 恢復原本的變形效果
      element.style.transform = originalTransform;

      // 計算 PDF 尺寸
      const imgWidth = 210; // A4 寬度 (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // 建立 PDF
      const pdf = new jsPDF({
        orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // 將圖片加入 PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // 下載 PDF
      pdf.save(fileName);

      return true;
    } catch (error) {
      console.error('匯出 PDF 失敗:', error);
      throw error;
    }
  }

  // 匯出為 JSON
  static exportAsJSON(data: WhiteboardData, fileName: string = 'whiteboard.json') {
    try {
      // 建立包含元資料的完整匯出物件
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: data
      };

      // 將資料轉換為 JSON 字串
      const jsonStr = JSON.stringify(exportData, null, 2);
      
      // 建立 Blob 並下載
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('匯出 JSON 失敗:', error);
      throw error;
    }
  }

  // 匯入 JSON
  static async importFromJSON(file: File): Promise<WhiteboardData> {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // 驗證資料格式
      if (!importData.data || !importData.data.notes || !importData.data.edges) {
        throw new Error('無效的檔案格式');
      }

      return importData.data;
    } catch (error) {
      console.error('匯入 JSON 失敗:', error);
      throw error;
    }
  }

  // 匯出選定區域
  static async exportSelection(selectedNoteIds: string[], whiteboardData: WhiteboardData, format: 'json' | 'png' = 'json') {
    if (format === 'json') {
      // 只匯出選定的便利貼和相關連線
      const selectedNotes = whiteboardData.notes.filter(note => selectedNoteIds.includes(note.id));
      const selectedEdges = whiteboardData.edges.filter(edge => 
        selectedNoteIds.includes(edge.from) && selectedNoteIds.includes(edge.to)
      );
      const selectedGroups = whiteboardData.groups.filter(group =>
        group.noteIds.some(noteId => selectedNoteIds.includes(noteId))
      );

      const selectionData: WhiteboardData = {
        notes: selectedNotes,
        edges: selectedEdges,
        groups: selectedGroups
      };

      return this.exportAsJSON(selectionData, 'whiteboard-selection.json');
    }
    
    // PNG 匯出需要特殊處理以只顯示選定項目
    // 這部分較複雜，可能需要建立臨時的隱藏 DOM 元素
    throw new Error('選定區域的 PNG 匯出尚未實作');
  }
}

// 簡單的匯出函數供快速使用
export const exportWhiteboard = {
  asPNG: (elementId?: string, fileName?: string) => ExportService.exportAsPNG(elementId, fileName),
  asPDF: (elementId?: string, fileName?: string) => ExportService.exportAsPDF(elementId, fileName),
  asJSON: (data: WhiteboardData, fileName?: string) => ExportService.exportAsJSON(data, fileName),
  importJSON: (file: File) => ExportService.importFromJSON(file),
  selection: (selectedNoteIds: string[], data: WhiteboardData, format?: 'json' | 'png') => 
    ExportService.exportSelection(selectedNoteIds, data, format)
};