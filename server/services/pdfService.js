const axios = require("axios");
const { ensureToken } = require("./newtonToken");
const fs = require("fs");
const path = require("path");
const os = require("os");
require("dotenv").config();

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

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

async function parsePDF(pdfBuffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8Array = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
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
      console.log(`[Doc] Parsing PDF...`);
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
  parsePPTX,
  splitIntoChunks,
  processDocument,
  getFileExtension,
};
