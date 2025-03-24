// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const logDiv = document.getElementById('log');
const progressBar = document.getElementById('progressBar');

// State
let selectedFiles = [];
const DPI = 600; // Fixed DPI value as per Python code

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
convertBtn.addEventListener('click', startConversion);

// Set directory input mode
fileInput.setAttribute('webkitdirectory', '');
fileInput.setAttribute('directory', '');

function isMacOSSystemFile(filename) {
    return filename.startsWith('._') || 
           filename.startsWith('__MACOSX') || 
           filename.includes('/__MACOSX/') ||
           filename.includes('/._');
}

async function extractZipFile(zipFile) {
    try {
        const zipContent = await zipFile.arrayBuffer();
        const zipReader = new JSZip();
        const zipData = await zipReader.loadAsync(zipContent);
        const extractedFiles = [];

        for (const [filename, content] of Object.entries(zipData.files)) {
            if (isMacOSSystemFile(filename)) {
                log(`⏭️ macOS sistem dosyası atlanıyor: ${filename}`);
                continue;
            }

            const fileContent = await content.async('blob');
            const file = new File([fileContent], filename, { type: content.type });
            extractedFiles.push(file);
        }

        return extractedFiles;
    } catch (error) {
        log(`❌ ${zipFile.name} ZIP dosyası çıkarılırken hata oluştu: ${error.message}`, true);
        return [];
    }
}

function handleFileSelect(event) {
    selectedFiles = Array.from(event.target.files);
    convertBtn.disabled = selectedFiles.length === 0;
    logDiv.innerHTML = '';
    
    // Log the number of files selected
    log(`📁 ${selectedFiles.length} dosya seçildi`);
}

function log(message, isError = false) {
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logEntry.className = isError ? 'error' : 'success';
    logDiv.appendChild(logEntry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

async function updatePNGDPI(pngFile) {
    try {
        // Create an image element
        const img = new Image();
        const imageUrl = URL.createObjectURL(pngFile);
        
        // Wait for image to load
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
        });

        // Create canvas with the same dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image on canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Convert to blob with DPI information
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png', 1.0);
        });

        // Clean up
        URL.revokeObjectURL(imageUrl);

        return blob;
    } catch (error) {
        log(`❌ ${pngFile.name} dosyası işlenirken hata oluştu: ${error.message}`, true);
        return null;
    }
}

async function processZipFile(zipFile, isNested = false) {
    const zip = new JSZip();
    let totalFiles = 0;
    let processedFiles = 0;
    let nestedZipFiles = [];

    // Extract and process ZIP contents
    const filesToProcess = await extractZipFile(zipFile);

    // First pass: identify nested ZIP files and count PNG files
    for (const fileToProcess of filesToProcess) {
        if (fileToProcess.type === 'application/zip' || fileToProcess.name.toLowerCase().endsWith('.zip')) {
            if (!isMacOSSystemFile(fileToProcess.name)) {
                nestedZipFiles.push(fileToProcess);
            }
        } else if (fileToProcess.type === 'image/png' || fileToProcess.name.toLowerCase().endsWith('.png')) {
            if (!isMacOSSystemFile(fileToProcess.name)) {
                totalFiles++;
            }
        }
    }

    // Process nested ZIP files first
    for (const nestedZip of nestedZipFiles) {
        log(`📦 İç ZIP dosyası işleniyor: ${nestedZip.name}`);
        const processedNestedZip = await processZipFile(nestedZip, true);
        if (processedNestedZip) {
            zip.file(nestedZip.name, processedNestedZip);
        }
    }

    // Process PNG files
    for (const fileToProcess of filesToProcess) {
        if (fileToProcess.type === 'image/png' || fileToProcess.name.toLowerCase().endsWith('.png')) {
            if (!isMacOSSystemFile(fileToProcess.name)) {
                const updatedPNG = await updatePNGDPI(fileToProcess);
                if (updatedPNG) {
                    zip.file(fileToProcess.name, updatedPNG);
                    processedFiles++;
                    progressBar.textContent = `İlerleme: ${processedFiles}/${totalFiles} dosya`;
                    log(`✅ ${fileToProcess.name} dosyası 600 DPI'ya güncellendi`);
                }
            } else {
                log(`⏭️ macOS sistem dosyası atlanıyor: ${fileToProcess.name}`);
            }
        }
    }

    if (totalFiles > 0 || nestedZipFiles.length > 0) {
        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // If this is a nested ZIP file, return the blob instead of downloading
            if (isNested) {
                return zipBlob;
            }

            // Otherwise, download the file
            const downloadUrl = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            // Use the ZIP file name with _600DPI_PNG suffix
            const zipName = zipFile.name.replace(/\.[^/.]+$/, '') + '_600DPI_PNG.zip';
            
            a.download = zipName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            log(`🎉 ${zipFile.name} dosyası için DPI güncelleme tamamlandı! ZIP dosyası indiriliyor...`);
        } catch (error) {
            log(`❌ ${zipFile.name} için ZIP dosyası oluşturulurken hata oluştu: ${error.message}`, true);
        }
    } else {
        log(`❌ ${zipFile.name} içinde güncellenecek geçerli dosya bulunamadı`, true);
    }
}

async function startConversion() {
    convertBtn.disabled = true;
    fileInput.disabled = true;
    progressBar.style.display = 'block';

    // Filter and process only ZIP files
    const zipFiles = selectedFiles.filter(file => 
        file.type === 'application/zip' || 
        file.name.toLowerCase().endsWith('.zip')
    );

    if (zipFiles.length === 0) {
        log('❌ Seçilen klasörde ZIP dosyası bulunamadı', true);
        convertBtn.disabled = false;
        fileInput.disabled = false;
        progressBar.style.display = 'none';
        return;
    }

    // Process each ZIP file
    for (const zipFile of zipFiles) {
        await processZipFile(zipFile);
    }

    convertBtn.disabled = false;
    fileInput.disabled = false;
    progressBar.style.display = 'none';
    log('🎉 Tüm ZIP dosyaları işlendi!');
} 