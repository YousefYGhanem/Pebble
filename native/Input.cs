using System.Runtime.InteropServices;

namespace Pebble.Native;

// Typing into the window in front, as if from the keyboard (SendInput with Unicode characters, so any language works).
// A line break is Shift+Enter: in chat apps a plain Enter sends.
static partial class Input
{
    public const ushort VK_RETURN = 0x0D, VK_SHIFT = 0x10;
    const uint INPUT_KEYBOARD = 1, KEYEVENTF_KEYUP = 0x2, KEYEVENTF_UNICODE = 0x4;

    [StructLayout(LayoutKind.Explicit, Size = 40)]
    struct INPUT
    {
        [FieldOffset(0)] public uint type;
        [FieldOffset(8)] public ushort vk;
        [FieldOffset(10)] public ushort scan;
        [FieldOffset(12)] public uint flags;
        [FieldOffset(16)] public uint time;
        [FieldOffset(24)] public nint extra;
    }

    [LibraryImport("user32.dll")] private static unsafe partial uint SendInput(uint count, INPUT* inputs, int size);

    static unsafe void Send(ReadOnlySpan<INPUT> inputs)
    {
        fixed (INPUT* p = inputs)
            if (SendInput((uint)inputs.Length, p, sizeof(INPUT)) != inputs.Length) throw new InvalidOperationException("typing was blocked");
    }

    static INPUT K(ushort vk, bool up) => new() { type = INPUT_KEYBOARD, vk = vk, flags = up ? KEYEVENTF_KEYUP : 0 };
    static INPUT U(char c, bool up) => new() { type = INPUT_KEYBOARD, scan = c, flags = KEYEVENTF_UNICODE | (up ? KEYEVENTF_KEYUP : 0) };

    public static void Key(ushort vk) => Send([K(vk, false), K(vk, true)]);

    public static void Type(string text)
    {
        foreach (var line in text.Replace("\r", "").Split('\n').Select((l, i) => (l, i)))
        {
            if (line.i > 0) Send([K(VK_SHIFT, false), K(VK_RETURN, false), K(VK_RETURN, true), K(VK_SHIFT, true)]);
            var batch = new List<INPUT>();
            foreach (var c in line.l) { batch.Add(U(c, false)); batch.Add(U(c, true)); }
            if (batch.Count > 0) Send(batch.ToArray());
        }
    }
}
