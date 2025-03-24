import fitz  # PyMuPDF
import os
import zipfile
import shutil
import tempfile

# PDF dosyalarının bulunduğu klasör
pdf_folder = "sinif8sozel2_outputs.zip"
dpi = 100

def is_valid_pdf(file_path):
    # macOS system files ve geçersiz dosyaları kontrol et
    if os.path.basename(file_path).startswith('._') or file_path.startswith('__MACOSX'):
        return False
    return file_path.lower().endswith('.pdf')

def process_pdfs(input_path, output_path):
    # Klasördeki tüm PDF dosyalarını recursive olarak bul
    pdf_files = []
    for root, dirs, files in os.walk(input_path):
        # __MACOSX klasörünü atla
        if '__MACOSX' in dirs:
            dirs.remove('__MACOSX')
        for file in files:
            file_path = os.path.join(root, file)
            if is_valid_pdf(file_path):
                pdf_files.append(file_path)

    if not pdf_files:
        print(f"Hata: '{input_path}' klasöründe PDF dosyası bulunamadı!")
        return False

    success = True
    for pdf_path in pdf_files:
        try:
            doc = fitz.open(pdf_path)  # PDF dosyasını aç

            # PDF içindeki her sayfayı PNG olarak kaydet
            for page_num in range(len(doc)):
                page = doc[page_num]
                pix = page.get_pixmap(dpi=dpi)

                # PNG dosyasını PDF ile aynı klasöre, sayfa numarası ile kaydet
                base_name = os.path.splitext(os.path.basename(pdf_path))[0]
                output_image_path = os.path.join(os.path.dirname(pdf_path), f"{base_name}__sayfa{page_num + 1}.png")

                pix.save(output_image_path)
                print(f"✅ Kaydedildi: {output_image_path}")

            doc.close()  # Belleği temizle

        except Exception as e:
            print(f"❌ Hata oluştu: {pdf_path} -> {e}")
            success = False
            continue  # Diğer dosyaları işlemeye devam et

    return success

def main():
    # Geçici klasör oluştur
    with tempfile.TemporaryDirectory() as temp_dir:
        # Eğer girdi ZIP dosyası ise
        if pdf_folder.lower().endswith('.zip'):
            # ZIP dosyasını geçici klasöre çıkart
            with zipfile.ZipFile(pdf_folder, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # PDF'leri işle
            if process_pdfs(temp_dir, None):
                # Sonuçları yeni bir ZIP dosyasına ekle
                output_zip = pdf_folder.replace('.zip', '_processed.zip')
                with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
                    for root, dirs, files in os.walk(temp_dir):
                        # __MACOSX klasörünü atla
                        if '__MACOSX' in dirs:
                            dirs.remove('__MACOSX')
                        for file in files:
                            if file.lower().endswith('.png'):
                                file_path = os.path.join(root, file)
                                arcname = os.path.relpath(file_path, temp_dir)
                                zip_ref.write(file_path, arcname)
                print(f"\n🎉 İşlenmiş dosyalar '{output_zip}' dosyasına kaydedildi!")
            else:
                print("\n❌ İşlem başarısız oldu!")
        else:
            # Normal klasör işleme
            if process_pdfs(pdf_folder, None):
                print("\n🎉 Tüm PDF'ler başarıyla PNG'ye dönüştürüldü!")
            else:
                print("\n❌ İşlem başarısız oldu!")

if __name__ == "__main__":
    main()