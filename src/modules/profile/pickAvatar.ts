import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Well above `Avatar`'s largest render size, well under the 2MB bucket limit. */
const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.8;

/** Opens the OS photo picker with a native 1:1 crop. Returns `null` on cancel. */
export async function pickAvatarAsset(): Promise<{ uri: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  return { uri: result.assets[0].uri };
}

/** Resizes and re-encodes a picked image as JPEG, ready to upload. */
export async function prepareAvatar(uri: string): Promise<{ uri: string }> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  return { uri: saved.uri };
}
