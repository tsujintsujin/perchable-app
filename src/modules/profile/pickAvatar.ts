import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Avatar never renders above `Avatar`'s `lg` (88px) anywhere in the app —
 * 512px is comfortably above any screen density that matters and keeps the
 * upload well under the 2MB bucket limit regardless of source photo size. */
const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.8;

/**
 * Opens the OS photo picker with a native 1:1 crop (DESIGN.md Build 7:
 * avatar tap → picker; the circular Avatar treatment wants a square
 * source), then resizes to a fixed max dimension and re-encodes as JPEG.
 * Resizing (not just `launchImageLibraryAsync`'s own `quality` param) is
 * what actually guarantees the file stays under the bucket's 2MB limit —
 * `quality` alone only compresses, it can't cap the pixel dimensions a
 * high-megapixel camera photo would otherwise keep after cropping.
 *
 * Returns `null` if the user cancels the picker or denies permission —
 * not an error, just nothing to do.
 */
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
