# PDF to PNG Converter

A PyQt6-based application that converts PDF files to PNG images with customizable DPI settings.

## Building the Executable

To build the executable for Windows, follow these steps:

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

2. Build the executable using PyInstaller:
```bash
pyinstaller dpi_gui.spec
```

The executable will be created in the `dist` folder as `PDF_to_PNG_Converter.exe`.

## Usage

1. Run the `PDF_to_PNG_Converter.exe` file
2. Select a DPI value (default is 100)
3. Choose either a folder containing PDF files or a ZIP file containing PDFs
4. Click "Dönüştür" to start the conversion process

## Features

- Convert PDF files to PNG images
- Support for both individual PDF files and ZIP archives
- Customizable DPI settings (72-600 DPI)
- Progress tracking and error reporting
- Maintains original file structure
- Handles multiple PDFs in a folder or ZIP file

## Requirements

- Windows 7 or later
- No additional software required (all dependencies are included in the executable) 