using System.IO.Compression;
using static Pebble.Native.Win32;

namespace Pebble.Native;

// A part of the screen as a PNG file (for the screen buddy). GDI copy + a small PNG writer (no System.Drawing,
// which NativeAOT cannot use).
static unsafe class Capture
{
    public static void Region(int x, int y, int w, int h, string file)
    {
        if (w <= 0 || h <= 0 || w > 16384 || h > 16384) throw new ArgumentException("bad size");
        var screen = GetDC(0);
        var mem = CreateCompatibleDC(screen);
        var bmp = CreateCompatibleBitmap(screen, w, h);
        var old = SelectObject(mem, bmp);
        try
        {
            if (!BitBlt(mem, 0, 0, w, h, screen, x, y, SRCCOPY | CAPTUREBLT)) throw new InvalidOperationException("BitBlt failed");
            SelectObject(mem, old);
            var bgra = new byte[w * h * 4];
            var info = new BITMAPINFOHEADER { biSize = (uint)sizeof(BITMAPINFOHEADER), biWidth = w, biHeight = -h, biPlanes = 1, biBitCount = 32 };
            fixed (byte* p = bgra) if (GetDIBits(mem, bmp, 0, (uint)h, p, &info, 0) == 0) throw new InvalidOperationException("GetDIBits failed");
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(file))!);
            File.WriteAllBytes(file, Png(bgra, w, h));
        }
        finally { DeleteObject(bmp); DeleteDC(mem); ReleaseDC(0, screen); }
    }

    /// <summary>32-bit BGRA (top-down) → PNG (RGB, opaque).</summary>
    public static byte[] Png(byte[] bgra, int w, int h)
    {
        using var raw = new MemoryStream();
        using (var z = new ZLibStream(raw, CompressionLevel.Fastest, leaveOpen: true))
        {
            var row = new byte[1 + w * 3];
            for (int y = 0; y < h; y++)
            {
                row[0] = 0; // filter: none
                for (int x = 0, i = y * w * 4; x < w; x++, i += 4) { row[1 + x * 3] = bgra[i + 2]; row[2 + x * 3] = bgra[i + 1]; row[3 + x * 3] = bgra[i]; }
                z.Write(row);
            }
        }
        using var png = new MemoryStream();
        png.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        var ihdr = new byte[13];
        BE(ihdr, 0, (uint)w); BE(ihdr, 4, (uint)h); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
        Chunk(png, "IHDR", ihdr);
        Chunk(png, "IDAT", raw.ToArray());
        Chunk(png, "IEND", []);
        return png.ToArray();
    }

    static void BE(byte[] b, int at, uint v) { b[at] = (byte)(v >> 24); b[at + 1] = (byte)(v >> 16); b[at + 2] = (byte)(v >> 8); b[at + 3] = (byte)v; }

    static void Chunk(Stream s, string type, byte[] data)
    {
        var head = new byte[8];
        BE(head, 0, (uint)data.Length);
        for (int i = 0; i < 4; i++) head[4 + i] = (byte)type[i];
        s.Write(head);
        s.Write(data);
        uint crc = Crc(Crc(0xFFFFFFFF, head.AsSpan(4)), data) ^ 0xFFFFFFFF;
        var c = new byte[4]; BE(c, 0, crc); s.Write(c);
    }

    static readonly uint[] Table = Enumerable.Range(0, 256).Select(n =>
    {
        uint c = (uint)n;
        for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1;
        return c;
    }).ToArray();

    static uint Crc(uint crc, ReadOnlySpan<byte> data)
    {
        foreach (var b in data) crc = Table[(crc ^ b) & 0xFF] ^ (crc >> 8);
        return crc;
    }
}
