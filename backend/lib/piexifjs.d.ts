// piexifjs ships no types. Only the one function JharSetu uses is declared.
declare module "piexifjs" {
  const piexif: {
    /** Takes a JPEG as a binary string, returns it without the EXIF segment. */
    remove(jpegBinary: string): string;
  };
  export default piexif;
}
