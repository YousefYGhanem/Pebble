using System.Runtime.InteropServices;

namespace Pebble.Native;

// The Win32 calls the sidecar needs. Source-generated (LibraryImport) so they work under NativeAOT.
static unsafe partial class Win32
{
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESSENTRY32W
    {
        public uint dwSize, cntUsage, th32ProcessID;
        public nint th32DefaultHeapID;
        public uint th32ModuleID, cntThreads, th32ParentProcessID;
        public int pcPriClassBase;
        public uint dwFlags;
        public fixed char szExeFile[260];
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFOHEADER
    {
        public uint biSize; public int biWidth, biHeight; public ushort biPlanes, biBitCount;
        public uint biCompression, biSizeImage; public int biXPelsPerMeter, biYPelsPerMeter; public uint biClrUsed, biClrImportant;
    }

    public const int SW_RESTORE = 9, GW_OWNER = 4, GA_ROOT = 2, GWL_EXSTYLE = -20, WS_EX_TOOLWINDOW = 0x80, DWMWA_CLOAKED = 14;
    public const uint TH32CS_SNAPPROCESS = 2, SRCCOPY = 0x00CC0020, CAPTUREBLT = 0x40000000, KEYEVENTF_KEYUP = 2;
    public const byte VK_MENU = 0x12, VK_LWIN = 0x5B;

    [LibraryImport("user32.dll")] public static partial nint GetForegroundWindow();
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool GetWindowRect(nint hwnd, out RECT rect);
    [LibraryImport("user32.dll", EntryPoint = "GetClassNameW")] public static partial int GetClassName(nint hwnd, char* buf, int max);
    [LibraryImport("user32.dll", EntryPoint = "GetWindowTextW")] public static partial int GetWindowText(nint hwnd, char* buf, int max);
    [LibraryImport("user32.dll")] public static partial uint GetWindowThreadProcessId(nint hwnd, out uint pid);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool SetProcessDpiAwarenessContext(nint value);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool IsWindowVisible(nint hwnd);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool IsWindow(nint hwnd);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool IsIconic(nint hwnd);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool ShowWindow(nint hwnd, int cmd);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool SetForegroundWindow(nint hwnd);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool BringWindowToTop(nint hwnd);
    [LibraryImport("user32.dll")] public static partial nint GetWindow(nint hwnd, int cmd);
    [LibraryImport("user32.dll")] public static partial nint GetAncestor(nint hwnd, int flags);
    [LibraryImport("user32.dll")] public static partial nint WindowFromPoint(POINT p);
    [LibraryImport("user32.dll", EntryPoint = "FindWindowExW")] public static partial nint FindWindowEx(nint parent, nint after, nint cls, nint title);
    [LibraryImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static partial nint GetWindowLongPtr(nint hwnd, int index);
    [LibraryImport("user32.dll")] public static partial void keybd_event(byte vk, byte scan, uint flags, nint extra);
    [LibraryImport("user32.dll")] public static partial nint GetDC(nint hwnd);
    [LibraryImport("user32.dll")] public static partial short GetAsyncKeyState(int key);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool GetCursorPos(out POINT p);
    [LibraryImport("user32.dll")] public static partial int ReleaseDC(nint hwnd, nint dc);
    [LibraryImport("dwmapi.dll")] public static partial int DwmGetWindowAttribute(nint hwnd, int attr, out int value, int size);
    [LibraryImport("kernel32.dll")] public static partial nint GetConsoleWindow();
    [LibraryImport("kernel32.dll", SetLastError = true)] public static partial nint CreateToolhelp32Snapshot(uint flags, uint pid);
    [LibraryImport("kernel32.dll", EntryPoint = "Process32FirstW")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool Process32First(nint snap, ref PROCESSENTRY32W entry);
    [LibraryImport("kernel32.dll", EntryPoint = "Process32NextW")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool Process32Next(nint snap, ref PROCESSENTRY32W entry);
    [LibraryImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool CloseHandle(nint handle);
    [LibraryImport("gdi32.dll")] public static partial nint CreateCompatibleDC(nint dc);
    [LibraryImport("gdi32.dll")] public static partial nint CreateCompatibleBitmap(nint dc, int w, int h);
    [LibraryImport("gdi32.dll")] public static partial nint SelectObject(nint dc, nint obj);
    [LibraryImport("gdi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool BitBlt(nint dst, int x, int y, int w, int h, nint src, int sx, int sy, uint rop);
    [LibraryImport("gdi32.dll")] public static partial int GetDIBits(nint dc, nint bmp, uint start, uint lines, void* bits, BITMAPINFOHEADER* info, uint usage);
    [LibraryImport("gdi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool DeleteObject(nint obj);
    [LibraryImport("gdi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool DeleteDC(nint dc);
    [LibraryImport("ole32.dll")] public static partial int PropVariantClear(ref PROPVARIANT pv);
    [LibraryImport("user32.dll")] public static partial short GetKeyState(int key);
    [LibraryImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static partial bool AttachThreadInput(uint from, uint to, [MarshalAs(UnmanagedType.Bool)] bool attach);
    [LibraryImport("kernel32.dll")] public static partial uint GetCurrentThreadId();
    [LibraryImport("user32.dll")] public static partial nint GetKeyboardLayout(uint thread);
    [LibraryImport("kernel32.dll")] public static partial int LCIDToLocaleName(uint lcid, char* name, int size, uint flags);
    [LibraryImport("ole32.dll")] public static partial int CoCreateInstance(in Guid clsid, nint outer, int ctx, in Guid iid, out nint ppv);

    public static string ClassName(nint hwnd) { var b = stackalloc char[256]; int n = GetClassName(hwnd, b, 256); return new string(b, 0, n); }
    public static string Title(nint hwnd) { var b = stackalloc char[512]; int n = GetWindowText(hwnd, b, 512); return new string(b, 0, n); }
    public static uint Pid(nint hwnd) { GetWindowThreadProcessId(hwnd, out var pid); return pid; }

    /// <summary>A real app window: visible, not cloaked (hidden UWP), not a tool window, no owner.</summary>
    public static bool IsAppWindow(nint hwnd)
    {
        if (!IsWindowVisible(hwnd) || GetWindow(hwnd, GW_OWNER) != 0) return false;
        if ((GetWindowLongPtr(hwnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW) != 0) return false;
        return DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, out var cloaked, 4) != 0 || cloaked == 0;
    }

    /// <summary>Every top-level window, in z-order (topmost first).</summary>
    public static IEnumerable<nint> TopWindows()
    {
        nint h = 0;
        while ((h = FindWindowEx(0, h, 0, 0)) != 0) yield return h;
    }

    /// <summary>pid → parent pid for every running process.</summary>
    public static Dictionary<uint, uint> ParentMap()
    {
        var map = new Dictionary<uint, uint>();
        var snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snap == -1) return map;
        try
        {
            var e = new PROCESSENTRY32W { dwSize = (uint)sizeof(PROCESSENTRY32W) };
            if (Process32First(snap, ref e))
                do map[e.th32ProcessID] = e.th32ParentProcessID; while (Process32Next(snap, ref e));
        }
        finally { CloseHandle(snap); }
        return map;
    }

    /// <summary>Caps Lock is on. A thread sees the toggle only through input it reads itself, so this one briefly shares
    /// the input state of the window in front (attached only for the one call).</summary>
    public static bool CapsLock()
    {
        var hwnd = GetForegroundWindow();
        uint fg = hwnd == 0 ? 0 : GetWindowThreadProcessId(hwnd, out _), me = GetCurrentThreadId();
        var attached = fg != 0 && fg != me && AttachThreadInput(me, fg, true);
        try { return (GetKeyState(0x14 /* VK_CAPITAL */) & 1) != 0; }
        finally { if (attached) AttachThreadInput(me, fg, false); }
    }

    /// <summary>The keyboard language of the window in front ("ar-SA", "en-US").</summary>
    public static string KeyboardLanguage()
    {
        var hwnd = GetForegroundWindow();
        var thread = hwnd == 0 ? 0 : GetWindowThreadProcessId(hwnd, out _);
        var lcid = (uint)(GetKeyboardLayout(thread) & 0xFFFF);
        var buf = stackalloc char[85];
        var n = LCIDToLocaleName(lcid, buf, 85, 0);
        return n > 1 ? new string(buf, 0, n - 1) : "";
    }
}
