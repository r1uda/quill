import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File, Paths, Directory } from "expo-file-system";
import { uid } from "../domain/model";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
export async function pickDocument(type = "*/*") {
  const r = await DocumentPicker.getDocumentAsync({
    type,
    copyToCacheDirectory: true,
  });
  if (r.canceled) return null;
  return r.assets[0];
}
export async function readBytes(asset: {
  uri: string;
  file?: globalThis.File;
}): Promise<ArrayBuffer> {
  if (Platform.OS === "web")
    return asset.file
      ? asset.file.arrayBuffer()
      : (await fetch(asset.uri)).arrayBuffer();
  return new File(asset.uri).arrayBuffer();
}
export async function pickImage(background = false) {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    base64: !background,
    quality: background ? 1 : 0.8,
    allowsEditing: false,
  });
  if (r.canceled) return null;
  const a = r.assets[0];
  if (!background && (a.fileSize || 0) > 18 * 1024 * 1024)
    throw new Error("图片太大，请选择18MB以内的图片");
  const data = a.base64
    ? `data:${Platform.OS === "web" ? a.mimeType || "image/jpeg" : "image/jpeg"};base64,${a.base64}`
    : a.uri;
  let uri = a.uri;
  if (!background && Platform.OS !== "web") {
    const directory = new Directory(Paths.document, "qingri-draft-images");
    directory.create({ intermediates: true, idempotent: true });
    const extension =
      (a.fileName || a.uri).match(/\.([a-zA-Z0-9]{2,5})$/)?.[1] || "jpg";
    const retained = new File(directory, `${uid()}.${extension}`);
    new File(a.uri).copy(retained);
    uri = retained.uri;
  }
  return {
    name: a.fileName || "图片",
    uri,
    data,
    width: a.width,
    height: a.height,
  };
}
export async function imageDataURL(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("无法读取图片"));
      reader.readAsDataURL(blob);
    });
  }
  const context = ImageManipulator.manipulate(uri);
  const rendered = await context.renderAsync();
  try {
    const result = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      base64: true,
      compress: 0.8,
    });
    if (!result.base64) throw new Error("无法读取图片");
    return `data:image/jpeg;base64,${result.base64}`;
  } finally {
    rendered.release();
    context.release();
  }
}
export async function exportText(
  name: string,
  text: string,
  mime = "application/json",
) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const f = new File(Paths.cache, name);
    f.write(text);
    await Sharing.shareAsync(f.uri, {
      mimeType: mime,
      dialogTitle: "保存日历备份",
    });
  }
}
