const axios = require("axios");
const { ensureToken } = require("./newtonToken");
const fs = require("fs");
const path = require("path");
const os = require("os");
require("dotenv").config();

const { recognizeImages, initializeOCR } = require("./ocrService");

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MIN_TEXT_DENSITY_THRESHOLD = 50;

const CLIENT_ID = process.env.NEWTON_CLIENT_ID;
const CLIENT_SECRET = process.env.NEWTON_CLIENT_SECRET;

async function downloadFile(url) {
  const token = await ensureToken();

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      Authorization: `Bearer ${token}`,
      "client-id": CLIENT_ID,
      "client-secret": CLIENT_SECRET,
    },
  });

  return Buffer.from(response.data);
}

function getFileExtension(url) {
  if (!url) return null;
  const urlPath = url.split("?")[0];
  return urlPath.substring(urlPath.lastIndexOf(".")).toLowerCase();
}

async function extractTextLayer(pdfBuffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8Array = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  });
  const pdf = await loadingTask.promise;

  let fullText = "";
  const pageTextLengths = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
    pageTextLengths.push(pageText.length);
  }

  return { text: fullText, pageTextLengths, numPages: pdf.numPages };
}

async function extractAnnotations(pdfBuffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8Array = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  });
  const pdf = await loadingTask.promise;

  let annotationTexts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const annotations = await page.getAnnotations();

      for (const annotation of annotations) {
        if (annotation.contents) {
          annotationTexts.push(annotation.contents);
        }
        if (annotation.richText) {
          annotationTexts.push(annotation.richText);
        }
        if (annotation.textContent) {
          annotationTexts.push(annotation.textContent);
        }
      }
    } catch (error) {
      console.warn(
        `[PDF] Annotation extraction failed for page ${i}:`,
        error.message,
      );
    }
  }

  return annotationTexts.join("\n");
}

async function renderPagesToImages(pdfBuffer, pagesToRender = []) {
  const { pdf } = await import("pdf-to-img");
  const images = [];
  let pageIndex = 0;

  try {
    const document = await pdf(pdfBuffer, { scale: 1.5 });

    for await (const image of document) {
      pageIndex++;

      if (pagesToRender.length === 0 || pagesToRender.includes(pageIndex)) {
        images.push({ pageNum: pageIndex, buffer: Buffer.from(image) });
        console.log(`[PDF] Rendered page ${pageIndex} to image`);
      }
    }
  } catch (error) {
    console.error(`[PDF] Failed to render pages: ${error.message}`);
  }

  return images;
}

function detectPagesNeedingOCR(pageTextLengths) {
  const pagesNeedingOCR = [];

  for (let i = 0; i < pageTextLengths.length; i++) {
    if (pageTextLengths[i] < MIN_TEXT_DENSITY_THRESHOLD) {
      pagesNeedingOCR.push(i + 1);
    }
  }

  return pagesNeedingOCR;
}

async function extractTables(pdfBuffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8Array = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  });
  const pdf = await loadingTask.promise;

  const tables = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const items = textContent.items.map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
      }));

      const rows = groupByRows(items);

      if (rows.length > 2) {
        const columns = detectColumns(rows);
        if (columns.length > 1) {
          const tableText = rows
            .map((row) => row.map((cell) => cell.str).join(" | "))
            .join("\n");
          tables.push({ page: i, content: tableText });
          console.log(`[PDF] Detected table on page ${i}`);
        }
      }
    } catch (error) {
      console.warn(
        `[PDF] Table extraction failed for page ${i}:`,
        error.message,
      );
    }
  }

  return tables;
}

function groupByRows(items, tolerance = 5) {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  let currentRow = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const lastItem = currentRow[currentRow.length - 1];

    if (Math.abs(item.y - lastItem.y) <= tolerance) {
      currentRow.push(item);
    } else {
      rows.push(currentRow.sort((a, b) => a.x - b.x));
      currentRow = [item];
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow.sort((a, b) => a.x - b.x));
  }

  return rows;
}

function detectColumns(rows) {
  const xPositions = [];

  for (const row of rows) {
    for (const item of row) {
      xPositions.push(item.x);
    }
  }

  const uniqueX = [...new Set(xPositions.map((x) => Math.round(x / 10) * 10))];
  return uniqueX.sort((a, b) => a - b);
}

async function parseMultiLayerPDF(pdfBuffer) {
  console.log("[PDF] Starting multi-layer extraction...");

  const result = {
    textLayer: "",
    ocrText: "",
    annotations: "",
    tables: [],
    metadata: {
      hasOCR: false,
      pagesWithOCR: [],
      tableCount: 0,
    },
  };

  const { text, pageTextLengths, numPages } = await extractTextLayer(pdfBuffer);
  result.textLayer = text;
  console.log(
    `[PDF] Extracted text layer: ${text.length} chars from ${numPages} pages`,
  );

  const pagesNeedingOCR = detectPagesNeedingOCR(pageTextLengths);

  if (pagesNeedingOCR.length > 0) {
    console.log(`[PDF] Pages needing OCR: ${pagesNeedingOCR.join(", ")}`);
    result.metadata.hasOCR = true;
    result.metadata.pagesWithOCR = pagesNeedingOCR;

    try {
      await initializeOCR();
      const images = await renderPagesToImages(pdfBuffer, pagesNeedingOCR);
      const imageBuffers = images.map((img) => img.buffer);
      const ocrResults = await recognizeImages(imageBuffers);
      result.ocrText = ocrResults.join("\n\n");
      console.log(`[PDF] OCR extracted: ${result.ocrText.length} chars`);
    } catch (error) {
      console.error("[PDF] OCR failed:", error.message);
    }
  }

  try {
    result.annotations = await extractAnnotations(pdfBuffer);
    if (result.annotations.length > 0) {
      console.log(
        `[PDF] Extracted annotations: ${result.annotations.length} chars`,
      );
    }
  } catch (error) {
    console.warn("[PDF] Annotation extraction failed:", error.message);
  }

  try {
    result.tables = await extractTables(pdfBuffer);
    result.metadata.tableCount = result.tables.length;
    if (result.tables.length > 0) {
      console.log(`[PDF] Detected ${result.tables.length} tables`);
    }
  } catch (error) {
    console.warn("[PDF] Table extraction failed:", error.message);
  }

  return result;
}

function combineContent(multiLayerResult) {
  const parts = [];

  if (multiLayerResult.textLayer.trim()) {
    parts.push(multiLayerResult.textLayer.trim());
  }

  if (multiLayerResult.ocrText.trim()) {
    parts.push("--- OCR Content ---");
    parts.push(multiLayerResult.ocrText.trim());
  }

  if (multiLayerResult.annotations.trim()) {
    parts.push("--- Annotations ---");
    parts.push(multiLayerResult.annotations.trim());
  }

  if (multiLayerResult.tables.length > 0) {
    parts.push("--- Tables ---");
    for (const table of multiLayerResult.tables) {
      parts.push(`Table from page ${table.page}:`);
      parts.push(table.content);
    }
  }

  return parts.join("\n\n");
}

async function parsePDF(pdfBuffer) {
  const multiLayerResult = await parseMultiLayerPDF(pdfBuffer);
  return combineContent(multiLayerResult);
}

async function parsePPTX(pptxBuffer) {
  const { OfficeParser } = require("officeparser");
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `temp_${Date.now()}.pptx`);

  try {
    fs.writeFileSync(tempFile, pptxBuffer);

    const result = await OfficeParser.parseOffice(tempFile, {
      extractAttachments: false,
      includeRawContent: false,
    });

    let text = "";
    if (typeof result === "string") {
      text = result;
    } else if (result && result.text) {
      text = result.text;
    } else if (result && result.slides) {
      for (const slide of result.slides) {
        text += JSON.stringify(slide) + "\n";
      }
    } else {
      text = JSON.stringify(result);
    }

    return text;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

function splitIntoChunks(
  text,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
) {
  const chunks = [];
  let start = 0;
  const cleanText = text.replace(/\s+/g, " ").trim();

  while (start < cleanText.length) {
    const end = Math.min(start + chunkSize, cleanText.length);
    const chunk = cleanText.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= cleanText.length - overlap) break;
  }

  return chunks;
}

async function processDocument(url) {
  const ext = getFileExtension(url);

  try {
    console.log(`[Doc] Downloading: ${url}`);
    const fileBuffer = await downloadFile(url);

    let text = "";

    if (ext === ".pdf") {
      console.log(`[Doc] Parsing PDF with multi-layer extraction...`);
      text = await parsePDF(fileBuffer);
    } else if (ext === ".pptx" || ext === ".ppt") {
      console.log(`[Doc] Parsing PPTX...`);
      text = await parsePPTX(fileBuffer);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    console.log(`[Doc] Extracted ${text.length} characters`);
    const chunks = splitIntoChunks(text);
    console.log(`[Doc] Split into ${chunks.length} chunks`);

    return chunks;
  } catch (error) {
    console.error(`[Doc] Error processing ${ext}:`, error.message);
    throw error;
  }
}

module.exports = {
  downloadFile,
  parsePDF,
  parseMultiLayerPDF,
  parsePPTX,
  splitIntoChunks,
  processDocument,
  getFileExtension,
  extractAnnotations,
  extractTables,
};
