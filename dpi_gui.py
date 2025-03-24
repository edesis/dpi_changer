import sys
import os
import zipfile
import tempfile
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                            QHBoxLayout, QPushButton, QLabel, QFileDialog, 
                            QSpinBox, QProgressBar, QMessageBox, QTextEdit)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
import fitz  # PyMuPDF

class PDFConverterThread(QThread):
    progress = pyqtSignal(str)
    finished = pyqtSignal(bool)
    
    def __init__(self, input_path, dpi):
        super().__init__()
        self.input_path = input_path
        self.dpi = dpi

    def is_valid_pdf(self, file_path):
        if os.path.basename(file_path).startswith('._') or file_path.startswith('__MACOSX'):
            return False
        return file_path.lower().endswith('.pdf')

    def process_pdfs(self, input_path):
        pdf_files = []
        for root, dirs, files in os.walk(input_path):
            if '__MACOSX' in dirs:
                dirs.remove('__MACOSX')
            for file in files:
                file_path = os.path.join(root, file)
                if self.is_valid_pdf(file_path):
                    pdf_files.append(file_path)

        if not pdf_files:
            self.progress.emit(f"Hata: '{input_path}' klasöründe PDF dosyası bulunamadı!")
            return False

        success = True
        for pdf_path in pdf_files:
            try:
                doc = fitz.open(pdf_path)
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    pix = page.get_pixmap(dpi=self.dpi)
                    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
                    output_image_path = os.path.join(os.path.dirname(pdf_path), 
                                                   f"{base_name}__sayfa{page_num + 1}.png")
                    pix.save(output_image_path)
                    self.progress.emit(f"✅ Kaydedildi: {output_image_path}")
                doc.close()
            except Exception as e:
                self.progress.emit(f"❌ Hata oluştu: {pdf_path} -> {e}")
                success = False
                continue
        return success

    def run(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            if self.input_path.lower().endswith('.zip'):
                with zipfile.ZipFile(self.input_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                
                if self.process_pdfs(temp_dir):
                    output_zip = self.input_path.replace('.zip', '_processed.zip')
                    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
                        for root, dirs, files in os.walk(temp_dir):
                            if '__MACOSX' in dirs:
                                dirs.remove('__MACOSX')
                            for file in files:
                                if file.lower().endswith('.png'):
                                    file_path = os.path.join(root, file)
                                    arcname = os.path.relpath(file_path, temp_dir)
                                    zip_ref.write(file_path, arcname)
                    self.progress.emit(f"\n🎉 İşlenmiş dosyalar '{output_zip}' dosyasına kaydedildi!")
                    self.finished.emit(True)
                else:
                    self.progress.emit("\n❌ İşlem başarısız oldu!")
                    self.finished.emit(False)
            else:
                if self.process_pdfs(self.input_path):
                    self.progress.emit("\n🎉 Tüm PDF'ler başarıyla PNG'ye dönüştürüldü!")
                    self.finished.emit(True)
                else:
                    self.progress.emit("\n❌ İşlem başarısız oldu!")
                    self.finished.emit(False)

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PDF to PNG Converter")
        self.setMinimumSize(800, 600)
        
        # Ana widget ve layout
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QVBoxLayout(main_widget)
        
        # DPI seçimi
        dpi_layout = QHBoxLayout()
        dpi_label = QLabel("DPI Değeri:")
        self.dpi_spinbox = QSpinBox()
        self.dpi_spinbox.setRange(72, 600)
        self.dpi_spinbox.setValue(100)
        self.dpi_spinbox.setSingleStep(1)
        dpi_layout.addWidget(dpi_label)
        dpi_layout.addWidget(self.dpi_spinbox)
        layout.addLayout(dpi_layout)
        
        # Seçim alanı
        selection_group = QWidget()
        selection_layout = QVBoxLayout(selection_group)
        
        # Klasör seçimi
        folder_layout = QHBoxLayout()
        self.folder_label = QLabel("Klasör seçilmedi")
        self.folder_button = QPushButton("Klasör Seç")
        self.folder_button.clicked.connect(self.select_folder)
        folder_layout.addWidget(self.folder_label)
        folder_layout.addWidget(self.folder_button)
        selection_layout.addLayout(folder_layout)
        
        # ZIP dosyası seçimi
        zip_layout = QHBoxLayout()
        self.zip_label = QLabel("ZIP dosyası seçilmedi")
        self.zip_button = QPushButton("ZIP Dosyası Seç")
        self.zip_button.clicked.connect(self.select_zip)
        zip_layout.addWidget(self.zip_label)
        zip_layout.addWidget(self.zip_button)
        selection_layout.addLayout(zip_layout)
        
        layout.addWidget(selection_group)
        
        # Dönüştür butonu
        self.convert_button = QPushButton("Dönüştür")
        self.convert_button.clicked.connect(self.start_conversion)
        self.convert_button.setEnabled(False)
        layout.addWidget(self.convert_button)
        
        # Log alanı
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        layout.addWidget(self.log_text)
        
        self.selected_path = None
        self.converter_thread = None

    def select_folder(self):
        folder_path = QFileDialog.getExistingDirectory(
            self,
            "PDF Dosyalarının Bulunduğu Klasörü Seç",
            ""
        )
        if folder_path:
            self.selected_path = folder_path
            self.folder_label.setText(os.path.basename(folder_path))
            self.zip_label.setText("ZIP dosyası seçilmedi")
            self.convert_button.setEnabled(True)

    def select_zip(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "ZIP Dosyası Seç",
            "",
            "ZIP Arşivleri (*.zip);;Tüm Dosyalar (*.*)"
        )
        if file_path:
            self.selected_path = file_path
            self.zip_label.setText(os.path.basename(file_path))
            self.folder_label.setText("Klasör seçilmedi")
            self.convert_button.setEnabled(True)

    def start_conversion(self):
        if not self.selected_path:
            return
            
        self.convert_button.setEnabled(False)
        self.folder_button.setEnabled(False)
        self.zip_button.setEnabled(False)
        self.dpi_spinbox.setEnabled(False)
        self.log_text.clear()
        
        self.converter_thread = PDFConverterThread(
            self.selected_path,
            self.dpi_spinbox.value()
        )
        self.converter_thread.progress.connect(self.update_log)
        self.converter_thread.finished.connect(self.conversion_finished)
        self.converter_thread.start()

    def update_log(self, message):
        self.log_text.append(message)
        self.log_text.verticalScrollBar().setValue(
            self.log_text.verticalScrollBar().maximum()
        )

    def conversion_finished(self, success):
        self.convert_button.setEnabled(True)
        self.folder_button.setEnabled(True)
        self.zip_button.setEnabled(True)
        self.dpi_spinbox.setEnabled(True)
        
        if success:
            QMessageBox.information(self, "Başarılı", "Dönüştürme işlemi tamamlandı!")
        else:
            QMessageBox.warning(self, "Hata", "Dönüştürme işlemi sırasında hatalar oluştu!")

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main() 