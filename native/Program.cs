namespace Pebble.Native;

// pebble-native.exe: everything Pebble needs from Windows that Electron cannot do, in one small native program.
//   serve --owner <pid>              Pebble's helper (JSON lines on stdin/stdout), see Server.cs
//   hook window|reply --port --token run by Claude Code as hooks, see Hooks.cs
//   hook relay --agent …             Gemini CLI and Cursor hooks (passes their events to Pebble)
//   cli notify|ask …                 the `pebble` command for scripts (cli/pebble.cmd calls this)
//   mcp                              an MCP server (notify, ask_user) for any agent that speaks MCP
//   selftest                         checks every capability, prints a JSON report
static class Program
{
    public const string Version = "0.6.0";

    static async Task<int> Main(string[] args)
    {
        Win32.SetProcessDpiAwarenessContext(-4); // per-monitor v2: real pixels everywhere
        var mode = args.FirstOrDefault() ?? "";
        switch (mode)
        {
            case "serve":
                return await Server.Run(uint.TryParse(Hooks.Options(args[1..]).GetValueOrDefault("owner"), out var owner) ? owner : 0);
            case "hook" when args.Length > 1:
                return await Hooks.Run(args[1], Hooks.Options(args[2..]));
            case "cli":
                return await Hooks.Cli(args[1..]);
            case "mcp":
                return await Mcp.Run();
            case "selftest":
                return await Selftest.Run();
            default:
                Console.WriteLine($"pebble-native {Version}: serve | hook window|reply|relay | cli notify|ask | mcp | selftest");
                return 64;
        }
    }
}
