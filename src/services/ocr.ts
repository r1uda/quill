export async function recognizeImage(uri: string): Promise<string> {
  const { requireNativeModule } = await import("expo-modules-core");
  try {
    return await requireNativeModule<{
      recognize: (uri: string) => Promise<string>;
    }>("QingriOcr").recognize(uri);
  } catch (error) {
    throw new Error(
      "本机图片识别暂不可用，请使用包含中文识别模块的安装版。" +
        ((error as Error).message || ""),
    );
  }
}
