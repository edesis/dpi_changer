

import zipfile
import os
import shutil
from PIL import Image

# ZIP dosyasının bulunduğu ana klasör (Yeni klasör yolunu buraya yazın)
zip_folder = r"C:\Users\BozkayAsus\Erkan\KES-DENEME\life store\whatsapp indirilen dosyalar\8. SINIF İNTERAKTİF"

# Alt klasörleri de dahil ederek ZIP dosyalarını çıkar
for root, dirs, files in os.walk(zip_folder):
    # ZIP dosyalarını bul
    zip_files = [f for f in files if f.lower().endswith(".zip")]

    for zip_file in zip_files:
        zip_path = os.path.join(root, zip_file)
        extract_folder = os.path.join(root, zip_file.replace(".zip", ""))  # ZIP dosyasının çıkacağı klasör

        # ZIP dosyasını çıkart
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_folder)
            print(f"{zip_file} ZIP dosyası çıkarıldı!")

        # Çıkarılan dosyalar üzerinde işlem yapma (PNG dosyaları)
        for sub_root, sub_dirs, sub_files in os.walk(extract_folder):
            png_files = [f for f in sub_files if f.lower().endswith(".png")]

            # Eğer PNG dosyaları varsa
            if png_files:
                # ZIP dosyasını tekrar oluştur
                zip_output_path = os.path.join(root, f"{os.path.basename(sub_root)}_600DPI_PNG.zip")
                with zipfile.ZipFile(zip_output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for png_file in png_files:
                        png_path = os.path.join(sub_root, png_file)

                        try:
                            # PNG dosyasını aç
                            img = Image.open(png_path)

                            # DPI'yı 600 olarak ayarla
                            img.save(png_path, dpi=(600, 600))

                            # 600 DPI ile kaydedilen dosyayı ZIP dosyasına ekle
                            zipf.write(png_path, arcname=png_file)
                            print(f"✅ {png_file} dosyası 600 DPI'ya güncellendi ve ZIP'e eklendi.")
                        except Exception as e:
                            print(f"❌ Hata oluştu: {png_file} -> {e}")

        # ZIP dosyasını çıkarıldıktan sonra klasörü sil (isteğe bağlı)
        shutil.rmtree(extract_folder)
        print(f"{zip_file} dosyasının içeriği temizlendi ve çıkarma klasörü silindi!")

print("\n🎉 Tüm işlemler tamamlandı! ZIP dosyaları dışarı çıkarıldı ve her biri 600 DPI'ya güncellendi.")