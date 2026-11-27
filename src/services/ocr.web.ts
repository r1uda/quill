export async function recognizeImage(uri: string): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("chi_sim+eng");
  try {
    return (await worker.recognize(uri)).data.text;
  } finally {
    await worker.terminate();
  }
}
