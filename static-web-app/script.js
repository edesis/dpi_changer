// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const dpiInput = document.getElementById('dpi');
const logDiv = document.getElementById('log');
const progressBar = document.getElementById('progressBar');

// State
let selectedFiles = [];

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
convertBtn.addEventListener('click', startConversion);

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
                log(`⏭️ Skipping macOS system file: ${filename}`);
                continue;
            }

            const fileContent = await content.async('blob');
            const file = new File([fileContent], filename, { type: content.type });
            extractedFiles.push(file);
        }

        return extractedFiles;
    } catch (error) {
        log(`❌ Error extracting ZIP file ${zipFile.name}: ${error.message}`, true);
        return [];
    }
}

function handleFileSelect(event) {
    selectedFiles = Array.from(event.target.files);
    convertBtn.disabled = selectedFiles.length === 0;
    logDiv.innerHTML = '';
    
    // Log the number of files selected
    log(`📁 Selected ${selectedFiles.length} files`);
}

function log(message, isError = false) {
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logEntry.className = isError ? 'error' : 'success';
    logDiv.appendChild(logEntry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

async function convertPDFToPNG(pdfFile, dpi) {
    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const numPages = pdf.numPages;
        const pngFiles = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: dpi / 72 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const pngData = canvas.toDataURL('image/png');
            pngFiles.push({
                name: `${pdfFile.name.replace('.pdf', '')}.png`,
                data: pngData
            });

            log(`✅ Converted page ${pageNum} of ${pdfFile.name}`);
        }

        return pngFiles;
    } catch (error) {
        log(`❌ Error converting ${pdfFile.name}: ${error.message}`, true);
        return [];
    }
}

async function startConversion() {
    const dpi = parseInt(dpiInput.value);
    if (dpi < 72 || dpi > 600) {
        log('❌ DPI value must be between 72 and 600', true);
        return;
    }

    convertBtn.disabled = true;
    fileInput.disabled = true;
    dpiInput.disabled = true;
    progressBar.style.display = 'block';

    // Group files by their source (folder or zip)
    const folderFiles = [];
    const zipFiles = [];

    for (const file of selectedFiles) {
        if (file.type === 'application/zip') {
            zipFiles.push(file);
        } else {
            folderFiles.push(file);
        }
    }

    // Process folder files as one batch if there are any
    if (folderFiles.length > 0) {
        const zip = new JSZip();
        let totalFiles = 0;
        let processedFiles = 0;

        // Count total valid files in folders
        for (const file of folderFiles) {
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                if (!isMacOSSystemFile(file.name)) {
                    totalFiles++;
                }
            }
        }

        // Process all folder files
        for (const file of folderFiles) {
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                if (!isMacOSSystemFile(file.name)) {
                    const pngFiles = await convertPDFToPNG(file, dpi);
                    pngFiles.forEach(png => {
                        const base64Data = png.data.split(',')[1];
                        // Preserve folder structure for folder uploads
                        const relativePath = file.webkitRelativePath || file.name;
                        const folderPath = relativePath.split('/').slice(0, -1).join('/');
                        const pdfBaseName = file.name.replace(/\.pdf$/i, '');
                        const pngName = `${pdfBaseName}.png`;
                        const outputPath = folderPath ? `${folderPath}/${pngName}` : pngName;
                        zip.file(outputPath, base64Data, { base64: true });
                    });
                    // Add the original PDF file
                    const fileContent = await file.arrayBuffer();
                    const relativePath = file.webkitRelativePath || file.name;
                    zip.file(relativePath, fileContent);
                    processedFiles++;
                    progressBar.textContent = `Progress: ${processedFiles}/${totalFiles} files`;
                } else {
                    log(`⏭️ Skipping macOS system file: ${file.name}`);
                }
            } else if (!file.name.toLowerCase().endsWith('.png')) {
                // Copy non-PDF and non-PNG files as is
                const fileContent = await file.arrayBuffer();
                const relativePath = file.webkitRelativePath || file.name;
                zip.file(relativePath, fileContent);
            }
        }

        if (totalFiles > 0) {
            try {
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const downloadUrl = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                
                // Use the folder name for the output ZIP
                const folderName = folderFiles[0].webkitRelativePath.split('/')[0];
                const zipName = `${folderName}.zip`;
                
                a.download = zipName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
                log(`🎉 Conversion completed for folder ${folderName}! Downloading ZIP file...`);
            } catch (error) {
                log(`❌ Error creating ZIP file for folder: ${error.message}`, true);
            }
        } else {
            log('❌ No valid PDF files found to convert in folders', true);
        }
    }

    // Process ZIP files separately
    for (const file of zipFiles) {
        const zip = new JSZip();
        let totalFiles = 0;
        let processedFiles = 0;

        // Extract and process ZIP contents
        const filesToProcess = await extractZipFile(file);

        // Count total valid files in this ZIP
        for (const fileToProcess of filesToProcess) {
            if (fileToProcess.type === 'application/pdf' || fileToProcess.name.toLowerCase().endsWith('.pdf')) {
                if (!isMacOSSystemFile(fileToProcess.name)) {
                    totalFiles++;
                }
            }
        }

        // Process files from this ZIP
        for (const fileToProcess of filesToProcess) {
            if (fileToProcess.type === 'application/pdf' || fileToProcess.name.toLowerCase().endsWith('.pdf')) {
                if (!isMacOSSystemFile(fileToProcess.name)) {
                    const pngFiles = await convertPDFToPNG(fileToProcess, dpi);
                    pngFiles.forEach(png => {
                        const base64Data = png.data.split(',')[1];
                        // Get the base name of the PDF file without extension
                        const pdfBaseName = fileToProcess.name.replace(/\.pdf$/i, '');
                        // Create PNG filename based on PDF name
                        const pngName = `${pdfBaseName}.png`;
                        // Add the PNG file to the root of the ZIP
                        zip.file(pngName, base64Data, { base64: true });
                    });
                    // Add the original PDF file
                    const fileContent = await fileToProcess.arrayBuffer();
                    zip.file(fileToProcess.name, fileContent);
                    processedFiles++;
                    progressBar.textContent = `Progress: ${processedFiles}/${totalFiles} files`;
                } else {
                    log(`⏭️ Skipping macOS system file: ${fileToProcess.name}`);
                }
            } else if (!fileToProcess.name.toLowerCase().endsWith('.png')) {
                // Copy non-PDF and non-PNG files as is
                const fileContent = await fileToProcess.arrayBuffer();
                zip.file(fileToProcess.name, fileContent);
            }
        }

        if (totalFiles > 0) {
            try {
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const downloadUrl = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                
                // Use the ZIP file name for the output
                const zipName = file.name.replace(/\.[^/.]+$/, '') + '.zip';
                
                a.download = zipName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
                log(`🎉 Conversion completed for ${file.name}! Downloading ZIP file...`);
            } catch (error) {
                log(`❌ Error creating ZIP file for ${file.name}: ${error.message}`, true);
            }
        } else {
            log(`❌ No valid PDF files found to convert in ${file.name}`, true);
        }
    }

    convertBtn.disabled = false;
    fileInput.disabled = false;
    dpiInput.disabled = false;
    progressBar.style.display = 'none';
} 