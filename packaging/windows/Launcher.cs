using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Макроквест")]
[assembly: AssemblyDescription("Локальный редактор графических квестов")]
[assembly: AssemblyVersion("0.1.0.0")]
[assembly: AssemblyFileVersion("0.1.0.0")]

internal sealed class LocalServer : IDisposable
{
    private readonly TcpListener listener;
    private readonly Dictionary<string, byte[]> files = new Dictionary<string, byte[]>();
    private readonly Semaphore slots = new Semaphore(16, 16);
    private volatile bool running;
    internal int Port { get { return ((IPEndPoint)listener.LocalEndpoint).Port; } }
    internal string Url { get { return "http://127.0.0.1:" + Port + "/"; } }

    internal LocalServer(int port)
    {
        Assembly assembly = Assembly.GetExecutingAssembly();
        foreach (string name in assembly.GetManifestResourceNames())
        {
            if (!name.StartsWith("site.")) continue;
            using (Stream input = assembly.GetManifestResourceStream(name))
            using (MemoryStream output = new MemoryStream())
            { input.CopyTo(output); files.Add("/" + name.Substring(5), output.ToArray()); }
        }
        listener = new TcpListener(IPAddress.Loopback, port);
        listener.Server.ExclusiveAddressUse = true;
    }

    internal void Start()
    {
        listener.Start(); running = true;
        Thread worker = new Thread(delegate() {
            while (running)
            {
                try
                {
                    TcpClient client = listener.AcceptTcpClient();
                    if (!slots.WaitOne(0)) { client.Close(); continue; }
                    ThreadPool.QueueUserWorkItem(delegate {
                        try { Handle(client); } catch (IOException) { } catch (SocketException) { }
                        finally { client.Close(); slots.Release(); }
                    });
                }
                catch (SocketException) { if (!running) return; }
                catch (ObjectDisposedException) { return; }
            }
        });
        worker.IsBackground = true; worker.Start();
    }

    private void Handle(TcpClient client)
    {
        client.ReceiveTimeout = 5000; client.SendTimeout = 5000;
        using (NetworkStream stream = client.GetStream())
        {
            MemoryStream request = new MemoryStream(); int last = 0;
            while (request.Length < 16384)
            {
                int value = stream.ReadByte(); if (value < 0) return;
                request.WriteByte((byte)value); last = (last << 8) | value;
                if (last == 0x0D0A0D0A) break;
            }
            if (last != 0x0D0A0D0A) { Reply(stream, 431, "text/plain", Encoding.UTF8.GetBytes("Headers too large"), false); return; }
            string[] lines = Encoding.ASCII.GetString(request.ToArray()).Split(new string[] { "\r\n" }, StringSplitOptions.None);
            string[] first = lines[0].Split(' ');
            if (first.Length != 3) { Reply(stream, 400, "text/plain", new byte[0], false); return; }
            string host = "";
            foreach (string line in lines) if (line.StartsWith("Host:", StringComparison.OrdinalIgnoreCase)) host = line.Substring(5).Trim();
            if (host != "127.0.0.1:" + Port) { Reply(stream, 403, "text/plain", new byte[0], false); return; }
            bool head = first[0] == "HEAD";
            if (first[0] != "GET" && !head) { Reply(stream, 405, "text/plain", new byte[0], false); return; }
            string path = first[1].Split('?')[0];
            if (path == "/__macroquest/health") { Reply(stream, 200, "application/json", Encoding.UTF8.GetBytes("{\"app\":\"macroquest\",\"version\":\"0.1.0\"}"), head); return; }
            if (path == "/") path = "/index.html";
            byte[] body;
            if (!files.TryGetValue(path, out body)) { Reply(stream, 404, "text/plain", Encoding.UTF8.GetBytes("Not found"), head); return; }
            string type = path.EndsWith(".html") ? "text/html" : path.EndsWith(".css") ? "text/css" : path.EndsWith(".js") ? "text/javascript" : "application/json";
            Reply(stream, 200, type, body, head);
        }
    }

    private static void Reply(Stream stream, int status, string type, byte[] body, bool head)
    {
        byte[] headers = Encoding.ASCII.GetBytes("HTTP/1.1 " + status + " " + (status == 200 ? "OK" : "Error") + "\r\nContent-Type: " + type + "; charset=utf-8\r\nContent-Length: " + body.Length + "\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nX-Macroquest-App: macroquest\r\n\r\n");
        stream.Write(headers, 0, headers.Length); if (!head) stream.Write(body, 0, body.Length);
    }

    internal void Verify()
    {
        foreach (KeyValuePair<string, byte[]> file in files)
        {
            using (WebClient client = new WebClient())
            {
                client.Proxy = null;
                byte[] actual = client.DownloadData(Url.TrimEnd('/') + file.Key);
                if (Convert.ToBase64String(actual) != Convert.ToBase64String(file.Value)) throw new IOException("Resource mismatch: " + file.Key);
            }
        }
    }
    public void Dispose() { running = false; listener.Stop(); }
}

internal static class Program
{
    private static void Open(string url) { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
    private static bool Existing(string url)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url + "__macroquest/health");
            request.Proxy = null; request.Timeout = 1200;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse()) return response.Headers["X-Macroquest-App"] == "macroquest";
        }
        catch (WebException) { return false; }
    }

    [STAThread]
    private static int Main(string[] args)
    {
        bool verify = Array.IndexOf(args, "--self-test") >= 0;
        bool serve = Array.IndexOf(args, "--serve-only") >= 0;
        int port = verify ? 0 : 4173;
        try
        {
            foreach (string arg in args) if (arg.StartsWith("--port=")) port = Int32.Parse(arg.Substring(7));
            string url = "http://127.0.0.1:" + port + "/";
            if (!verify && !serve && Existing(url)) { Open(url); return 0; }
            using (LocalServer server = new LocalServer(port))
            {
                try { server.Start(); }
                catch (SocketException)
                {
                    if (!verify && !serve && Existing(url)) { Open(url); return 0; }
                    throw new IOException("Порт " + port + " занят другой программой. Закройте её и снова запустите Макроквест.");
                }
                if (verify) { server.Verify(); return 0; }
                if (serve) { Thread.Sleep(Timeout.Infinite); return 0; }
                Application.EnableVisualStyles();
                using (NotifyIcon tray = new NotifyIcon())
                using (ContextMenu menu = new ContextMenu())
                {
                    menu.MenuItems.Add("Открыть Макроквест", delegate { Open(server.Url); });
                    menu.MenuItems.Add("Остановить Макроквест", delegate { Application.Exit(); });
                    tray.Icon = SystemIcons.Application; tray.Text = "Макроквест — локальный редактор"; tray.ContextMenu = menu;
                    tray.DoubleClick += delegate { Open(server.Url); }; tray.Visible = true;
                    Open(server.Url); Application.Run(); tray.Visible = false;
                }
            }
            return 0;
        }
        catch (Exception error)
        {
            if (!verify && !serve) MessageBox.Show(error.Message, "Макроквест", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
