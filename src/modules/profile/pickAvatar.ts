import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Well above `Avatar`'s largest render size, well under the 2MB bucket limit. */
const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.8;

/** Opens the OS photo picker with a native 1:1 crop, then resizes and
 * re-encodes as JPEG. Returns `null` on cancel/denied permission. */
export async function pickAvatar(): Promise<{ uri: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  const context = ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  return { uri: saved.uri };
}
