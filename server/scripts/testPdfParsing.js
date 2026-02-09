const fs = require("fs");
const path = require("path");

const {
  parsePDF,
  parseMultiLayerPDF,
  splitIntoChunks,
  extractAnnotations,
  extractTables,
} = require("../services/pdfService");
const { terminateOCR, initializeOCR } = require("../services/ocrService");

async function createTestPDF() {
  const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 12;

  page.drawText("Test PDF Document for Multi-Layer Parsing", {
    x: 50,
    y: height - 50,
    size: 18,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(
    "This is a sample paragraph of text to test the text layer extraction.",
    {
      x: 50,
      y: height - 100,
      size: fontSize,
      font: timesRomanFont,
    },
  );

  page.drawText("Lorem ipsum dolor sit amet, consectetur adipiscing elit.", {
    x: 50,
    y: height - 130,
    size: fontSize,
    font: timesRomanFont,
  });

  page.drawText("Header 1    |    Header 2    |    Header 3", {
    x: 50,
    y: height - 200,
    size: fontSize,
    font: timesRomanFont,
  });

  page.drawText("Value A     |    Value B     |    Value C", {
    x: 50,
    y: height - 220,
    size: fontSize,
    font: timesRomanFont,
  });

  page.drawText("Value D     |    Value E     |    Value F", {
    x: 50,
    y: height - 240,
    size: fontSize,
    font: timesRomanFont,
  });

  return await pdfDoc.save();
}

async function testWithLocalFile(filePath) {
  console.log(`\n--- Testing with local file: ${filePath} ---\n`);
  const pdfBuffer = fs.readFileSync(filePath);
  return await runTests(pdfBuffer);
}

async function testWithGeneratedPDF() {
  console.log("\n--- Testing with generated PDF ---\n");

  try {
    require.resolve("pdf-lib");
  } catch {
    console.log("Installing pdf-lib for test generation...");
    require("child_process").execSync("npm install pdf-lib", {
      stdio: "inherit",
    });
  }

  const pdfBytes = await createTestPDF();
  return await runTests(Buffer.from(pdfBytes));
}

async function runTests(pdfBuffer) {
  console.log(`PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

  console.log("\n[1] Testing Text Layer Extraction...");
  const multiLayerResult = await parseMultiLayerPDF(pdfBuffer);

  console.log("\n--- Extraction Results ---");
  console.log(`✓ Text Layer: ${multiLayerResult.textLayer.length} characters`);
  console.log(`✓ OCR Text: ${multiLayerResult.ocrText.length} characters`);
  console.log(
    `✓ Annotations: ${multiLayerResult.annotations.length} characters`,
  );
  console.log(`✓ Tables Found: ${multiLayerResult.tables.length}`);
  console.log(`✓ Needs OCR: ${multiLayerResult.metadata.hasOCR}`);

  if (multiLayerResult.textLayer.length > 0) {
    console.log("\n--- Text Preview (first 300 chars) ---");
    console.log(multiLayerResult.textLayer.substring(0, 300));
  }

  console.log("\n[2] Testing Combined Output...");
  const combinedText = await parsePDF(pdfBuffer);
  console.log(`✓ Combined text: ${combinedText.length} characters`);

  console.log("\n[3] Testing Chunking...");
  const chunks = splitIntoChunks(combinedText);
  console.log(`✓ Created ${chunks.length} chunks`);

  if (chunks.length > 0) {
    console.log(`✓ First chunk (100 chars): ${chunks[0].substring(0, 100)}...`);
  }

  return {
    success: true,
    textLength: multiLayerResult.textLayer.length,
    ocrLength: multiLayerResult.ocrText.length,
    tableCount: multiLayerResult.tables.length,
    chunkCount: chunks.length,
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("PDF Multi-Layer Parsing Test Suite");
  console.log("=".repeat(60));

  const args = process.argv.slice(2);

  try {
    let result;

    if (args[0] && fs.existsSync(args[0])) {
      result = await testWithLocalFile(args[0]);
    } else {
      result = await testWithGeneratedPDF();
    }

    console.log("\n" + "=".repeat(60));
    console.log("TEST RESULTS: PASSED");
    console.log("=".repeat(60));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n--- TEST FAILED ---");
    console.error("Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await terminateOCR();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

