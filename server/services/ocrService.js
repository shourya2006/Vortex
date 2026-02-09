const Tesseract = require("tesseract.js");
const sharp = require("sharp");

let scheduler = null;
const WORKER_COUNT = 2;

async function initializeOCR() {
  if (scheduler) return scheduler;

  console.log("[OCR] Initializing Tesseract scheduler...");
  scheduler = Tesseract.createScheduler();

  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = await Tesseract.createWorker("eng", 1, {
      cachePath: "/tmp/tesseract-cache",
    });
    scheduler.addWorker(worker);
    console.log(`[OCR] Worker ${i + 1} ready`);
  }

  console.log("[OCR] Scheduler initialized with", WORKER_COUNT, "workers");
  return scheduler;
}

async function preprocessImage(imageBuffer) {
  try {
    const processed = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .sharpen()
      .threshold(128)
      .png()
      .toBuffer();
    return processed;
  } catch (error) {
    console.warn(
      "[OCR] Image preprocessing failed, using original:",
      error.message,
    );
    return imageBuffer;
  }
}

async function recognizeImage(imageBuffer, preprocess = true) {
  const sched = await initializeOCR();

  let buffer = imageBuffer;
  if (preprocess) {
    buffer = await preprocessImage(imageBuffer);
  }

  const { data } = await sched.addJob("recognize", buffer);
  return data.text.trim();
}

async function recognizeImages(imageBuffers) {
  const sched = await initializeOCR();

  const results = await Promise.all(
    imageBuffers.map(async (buffer, index) => {
      try {
        const processed = await preprocessImage(buffer);
        const { data } = await sched.addJob("recognize", processed);
        console.log(
          `[OCR] Page ${index + 1} processed: ${data.text.length} chars`,
        );
        return data.text.trim();
      } catch (error) {
        console.error(`[OCR] Page ${index + 1} failed:`, error.message);
        return "";
      }
    }),
  );

  return results;
}

async function terminateOCR() {
  if (scheduler) {
    await scheduler.terminate();
    scheduler = null;
    console.log("[OCR] Scheduler terminated");
  }
}

function isSchedulerInitialized() {
  return scheduler !== null;
}

module.exports = {
  initializeOCR,
  recognizeImage,
  recognizeImages,
  preprocessImage,
  terminateOCR,
  isSchedulerInitialized,
};
