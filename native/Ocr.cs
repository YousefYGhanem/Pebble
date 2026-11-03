using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;
using Windows.Storage.Streams;

namespace Pebble.Native;

// The text in a picture, with Windows' own OCR (the languages installed for your account). The screen buddy uses it for
// models that cannot see images (DeepSeek), and as extra context for the others.
static class Ocr
{
    public static async Task<string> File(string path)
    {
        var file = await StorageFile.GetFileFromPathAsync(Path.GetFullPath(path));
        using IRandomAccessStream s = await file.OpenAsync(FileAccessMode.Read);
        var decoder = await BitmapDecoder.CreateAsync(s);
        // OCR has a size limit: shrink very large captures (4K screens) to fit
        var max = OcrEngine.MaxImageDimension;
        var scale = Math.Min(1.0, (double)max / Math.Max(decoder.PixelWidth, decoder.PixelHeight));
        var transform = new BitmapTransform { ScaledWidth = (uint)(decoder.PixelWidth * scale), ScaledHeight = (uint)(decoder.PixelHeight * scale) };
        using var bmp = await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied, transform,
            ExifOrientationMode.IgnoreExifOrientation, ColorManagementMode.DoNotColorManage);
        var engine = OcrEngine.TryCreateFromUserProfileLanguages() ?? throw new InvalidOperationException("no OCR language installed");
        var result = await engine.RecognizeAsync(bmp);
        return string.Join("\n", result.Lines.Select(l => l.Text));
    }
}
